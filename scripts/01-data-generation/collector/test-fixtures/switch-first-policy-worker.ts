// Persistenter external_command-Worker fuer Replay-Tests: wechselt im ersten Zug jedes Kampfes auf Party-Slot 1
// (Aktion 5), danach immer die erste legale Aktion.
import { createInterface } from "node:readline";

type PolicyRequest = { shutdown?: boolean; step_index?: number; action_mask: number[] };

createInterface({ input: process.stdin }).on("line", line => {
  const request = JSON.parse(line) as PolicyRequest;
  if (request.shutdown) {
    process.exit(0);
  }
  const legal = request.action_mask.flatMap((value, index) => (value === 1 ? [index] : []));
  const action = request.step_index === 0 && legal.includes(5) ? 5 : legal[0];
  process.stdout.write(`${JSON.stringify({ action })}\n`);
});
