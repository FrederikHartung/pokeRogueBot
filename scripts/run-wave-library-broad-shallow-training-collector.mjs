import path from "node:path";
import { fileURLToPath } from "node:url";
import { runProfileCollector } from "./run-wave-library-collector-profile.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const profilePath = path.join(repoRoot, "data", "rl", "wave-library-profile-train-broad-shallow.json");

const result = runProfileCollector(profilePath, {
  prepareOnly: process.argv.slice(2).includes("--prepare-only"),
});

if (result.statusCode !== 0) {
  process.exit(result.statusCode);
}
