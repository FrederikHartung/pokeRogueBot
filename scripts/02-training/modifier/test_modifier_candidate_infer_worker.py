"""Tests fuer den Modifier-Inferenz-Worker: gleiche Bewertung wie das Trainings-Encoding, Maske, stdin-Protokoll.

Aufruf: npm run rl:test:modifier:model-worker
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

import torch

from modifier_candidate_infer_worker import load_checkpoint, score_candidates, select_candidate
from train_modifier_candidate_model import REPO_ROOT, CandidateScorer, FeatureEncoder

EXAMPLE_PATH = os.path.join(REPO_ROOT, "docs", "rl-schema", "modifier-transition-v1.example.json")
WORKER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "modifier_candidate_infer_worker.py")


def load_example() -> dict:
    with open(EXAMPLE_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


class ModifierCandidateWorkerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.observation = load_example()
        cls.mask = [candidate["mask"] for candidate in cls.observation["candidates"]]
        # Kleine Vokabel aus dem Beispiel, damit Item-Embeddings mitgetestet werden.
        encoder = FeatureEncoder.build([cls.observation] * 5)
        torch.manual_seed(3)
        model = CandidateScorer(encoder.state_dim, encoder.candidate_dim, len(encoder.item_vocab), hidden=32)
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.checkpoint = os.path.join(cls.temp_dir.name, "modifier-candidate-model.pt")
        torch.save(
            {
                "model_state": model.state_dict(),
                "encoder": encoder.to_json(),
                "hidden": 32,
                "state_dim": encoder.state_dim,
                "candidate_dim": encoder.candidate_dim,
            },
            cls.checkpoint,
        )
        cls.model, cls.encoder = load_checkpoint(cls.checkpoint)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temp_dir.cleanup()

    def test_scores_only_valid_candidates(self) -> None:
        scores = score_candidates(self.model, self.encoder, self.observation, self.mask)
        for value, mask in zip(scores, self.mask):
            self.assertEqual(value is not None, mask == 1)
        best = select_candidate(scores)
        self.assertEqual(self.mask[best], 1)
        self.assertEqual(scores[best], max(value for value in scores if value is not None))

    def test_scores_match_training_encoding_per_candidate(self) -> None:
        # Training bewertet je Zeile genau einen Kandidaten (build_tensors); die Inferenz bewertet alle gueltigen im
        # Batch. Beides muss denselben Wert liefern.
        scores = score_candidates(self.model, self.encoder, self.observation, self.mask)
        state = torch.tensor([self.encoder.encode_state(self.observation)], dtype=torch.float32)
        for index, candidate in enumerate(self.observation["candidates"]):
            if self.mask[index] != 1:
                continue
            vector, item = self.encoder.encode_candidate(self.observation, candidate)
            with torch.no_grad():
                single = float(self.model(state, torch.tensor([vector]), torch.tensor([item]))[0])
            self.assertAlmostEqual(scores[index], single, places=5)

    def test_rejects_all_masked_and_wrong_length(self) -> None:
        with self.assertRaises(ValueError):
            score_candidates(self.model, self.encoder, self.observation, [0] * len(self.mask))
        with self.assertRaises(ValueError):
            score_candidates(self.model, self.encoder, self.observation, self.mask[:-1])

    def test_worker_protocol(self) -> None:
        expected = select_candidate(score_candidates(self.model, self.encoder, self.observation, self.mask))
        requests = [
            {"describe": True},
            {"state": self.observation, "action_mask": self.mask},
            {"state": self.observation, "action_mask": [0] * len(self.mask)},
            {"shutdown": True},
        ]
        result = subprocess.run(
            [sys.executable, WORKER_PATH, "--checkpoint", self.checkpoint],
            input="".join(json.dumps(request) + "\n" for request in requests),
            capture_output=True,
            text=True,
            timeout=120,
            check=True,
        )
        responses = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
        self.assertEqual(len(responses), 3)
        self.assertEqual(responses[0]["state_dim"], self.encoder.state_dim)
        self.assertEqual(responses[1]["action"], expected)
        self.assertIn("error", responses[2])


if __name__ == "__main__":
    unittest.main()
