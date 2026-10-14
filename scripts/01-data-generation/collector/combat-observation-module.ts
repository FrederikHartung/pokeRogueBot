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

// Der modifier-v1-Builder importiert seinerseits "./combat-observation" (gemeinsame Party-Merkmale).
const MODIFIER_OBSERVATION_IMPORT = 'from "#bot-ts/modifier-observation"';
const MODIFIER_OBSERVATION_LOCAL_IMPORT = 'from "./modifier-observation"';

export function modifierObservationSourcePath(repoRoot: string): string {
  return path.join(repoRoot, "src", "main", "ts", "lib", "modifier-observation.ts");
}

/**
 * Schreibt modifier-observation.ts und combat-observation.ts nach `targetDir` und gibt die Template-Quelle mit lokalen
 * Imports zurueck.
 */
export function linkModifierObservationModule(templateSource: string, targetDir: string, repoRoot: string): string {
  writeFileSync(
    path.join(targetDir, "modifier-observation.ts"),
    readFileSync(modifierObservationSourcePath(repoRoot), "utf8"),
    { encoding: "utf8" },
  );
  return linkCombatObservationModule(templateSource, targetDir, repoRoot).replaceAll(
    MODIFIER_OBSERVATION_IMPORT,
    MODIFIER_OBSERVATION_LOCAL_IMPORT,
  );
}
