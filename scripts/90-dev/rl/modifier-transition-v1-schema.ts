import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Validierung gegen docs/rl-schema/modifier-transition-v1.schema.json, gemeinsam fuer Contract und Spieltest.
// ajv kommt ueber die Submodul-Abhaengigkeiten mit; das Hauptrepo hat keine eigene Kopie.

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const schemaPath = path.join(repoRoot, "docs", "rl-schema", "modifier-transition-v1.schema.json");

type ValidateFn = ((data: unknown) => boolean) & { errors?: Array<{ instancePath?: string; message?: string }> | null };

let cachedValidator: ValidateFn | null = null;

function getValidator(): ValidateFn {
  if (cachedValidator) {
    return cachedValidator;
  }
  const requireFromPokerogue = createRequire(path.join(repoRoot, "pokerogue", "package.json"));
  const Ajv2020 = requireFromPokerogue("ajv/dist/2020").default;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  cachedValidator = ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8"))) as ValidateFn;
  return cachedValidator;
}

/** Gibt null zurueck, wenn der Datensatz gueltig ist, sonst eine kurze Fehlerbeschreibung. */
export function modifierTransitionV1Errors(record: unknown): string | null {
  const validate = getValidator();
  if (validate(record)) {
    return null;
  }
  return (validate.errors ?? [])
    .slice(0, 5)
    .map(error => `${error.instancePath || "/"} ${error.message ?? "invalid"}`)
    .join("; ");
}
