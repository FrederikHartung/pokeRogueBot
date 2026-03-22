import { readdirSync, rmSync } from "node:fs";
import path from "node:path";

const pipelineRunDir = "data/rl/pipeline-runs";
const resolvedPipelineRunDir = path.resolve(pipelineRunDir);
const expectedSuffix = path.join("data", "rl", "pipeline-runs");

console.log("clean-temp-data started");
console.log("target:", resolvedPipelineRunDir);

if (!resolvedPipelineRunDir.endsWith(expectedSuffix)) {
  throw new Error(
    `Refusing to clean unexpected directory: ${resolvedPipelineRunDir}`,
  );
}

// Read all entries in the pipeline run directory and remove them recursively
let deletedEntriesCount = 0;
for (const entry of readdirSync(pipelineRunDir)) {
  const entryPath = path.join(pipelineRunDir, entry);
  rmSync(entryPath, { recursive: true, force: true });
  deletedEntriesCount += 1;
}

console.log(
  `Deleted ${deletedEntriesCount} entries from ${resolvedPipelineRunDir}`,
);
console.log("clean-temp-data finished");
