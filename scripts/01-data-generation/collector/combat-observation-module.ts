import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Collector-Templates importieren den gemeinsamen combat-v4-Builder ueber den Alias "#bot-ts/combat-observation"
// (Root-tsconfig, fuer `npm run typecheck:scripts`). Im Submodul gibt es den Alias nicht: die Runner kopieren den Builder
// neben den generierten Test und biegen den Import auf die Kopie um.
const COMBAT_OBSERVATION_IMPORT = 'from "#bot-ts/combat-observation"';
const COMBAT_OBSERVATION_LOCAL_IMPORT = 'from "./combat-observation"';

export function combatObservationSourcePath(repoRoot: string): string {
  return path.join(repoRoot, "src", "main", "ts", "lib", "combat-observation.ts");
}

/** Schreibt den Builder nach `targetDir/combat-observation.ts` und gibt die Template-Quelle mit lokalem Import zurueck. */
export function linkCombatObservationModule(templateSource: string, targetDir: string, repoRoot: string): string {
  writeFileSync(
    path.join(targetDir, "combat-observation.ts"),
    readFileSync(combatObservationSourcePath(repoRoot), "utf8"),
    { encoding: "utf8" },
  );
  return templateSource.replaceAll(COMBAT_OBSERVATION_IMPORT, COMBAT_OBSERVATION_LOCAL_IMPORT);
}
