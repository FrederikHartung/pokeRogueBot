#!/usr/bin/env python3
import argparse
import json
import sys

from dqn_policy_infer import _sanitize_action_mask, load_model, select_action


def main() -> None:
    parser = argparse.ArgumentParser(description="Persistent DQN inference worker")
    parser.add_argument("--checkpoint", required=True, help="Path to .pt checkpoint")
    parser.add_argument("--device", default="cpu", help="Torch device")
    args = parser.parse_args()

    model, output_dim = load_model(args.checkpoint, args.device)

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        try:
            payload = json.loads(line)
            if payload.get("shutdown") is True:
                break

            state = payload.get("state") if isinstance(payload.get("state"), dict) else {}
            action_mask = _sanitize_action_mask(payload.get("action_mask"), output_dim)
            action = select_action(model, state, action_mask, args.device)
            response = {"action": action}
        except Exception as exc:  # noqa: BLE001 - worker must serialize inference errors
            response = {"error": str(exc)}

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
