import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CombatTransition } from "#test/test-utils/rl/combat-env";

export interface JsonlTransitionRecord extends CombatTransition {
  episodeId: string;
  stepIndex: number;
  timestamp: number;
}

/**
 * Simple append-only JSONL writer for RL transitions.
 * Keeps format stable for external Python/PyTorch training jobs.
 */
export class JsonlTransitionLogger {
  constructor(private readonly outputPath: string) {}

  async log(record: JsonlTransitionRecord): Promise<void> {
    await mkdir(dirname(this.outputPath), { recursive: true });
    const line = `${JSON.stringify(record)}\n`;
    await appendFile(this.outputPath, line, { encoding: "utf8" });
  }
}
