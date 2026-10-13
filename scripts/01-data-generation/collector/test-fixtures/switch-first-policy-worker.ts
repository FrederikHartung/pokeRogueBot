// Persistenter external_command-Worker fuer Replay-Tests: wechselt im ersten Kampfzug (decision_kind 0) jedes Kampfes
// auf Party-Slot 1 (Aktion 5), danach immer die erste legale Aktion. Beim Wechselangebot zu Kampfbeginn (decision_kind 2)
// ist die erste legale Aktion der aktive Slot, also "bleiben"; der Befehlswechsel im ersten Zug bleibt damit erhalten.
import { createInterface } from "node:readline";

type PolicyRequest = {
  shutdown?: boolean;
  episode_id?: string;
  decision_kind?: number;
  action_mask: number[];
};

const episodesWithCommandSwitch = new Set<string>();

createInterface({ input: process.stdin }).on("line", line => {
  const request = JSON.parse(line) as PolicyRequest;
  if (request.shutdown) {
    process.exit(0);
  }
  const legal = request.action_mask.flatMap((value, index) => (value === 1 ? [index] : []));
  const episodeId = request.episode_id ?? "unknown";
  const isCommand = (request.decision_kind ?? 0) === 0;
  const firstCommand = isCommand && !episodesWithCommandSwitch.has(episodeId);
  if (isCommand) {
    episodesWithCommandSwitch.add(episodeId);
  }
  const action = firstCommand && legal.includes(5) ? 5 : legal[0];
  process.stdout.write(`${JSON.stringify({ action })}\n`);
});
