import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function usage() {
  console.error(
    "Usage: node scripts/merge-rl-jsonl-datasets.mjs"
      + " --output <output.jsonl>"
      + " --input <path[:source_label]>"
      + " [--input <path[:source_label]> ...]",
  );
}

const args = process.argv.slice(2);
let outputPath = null;
const inputs = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--output") {
    outputPath = args[i + 1] ?? null;
    i += 1;
    continue;
  }
  if (arg === "--input") {
    const value = args[i + 1] ?? null;
    if (value) {
      inputs.push(value);
    }
    i += 1;
    continue;
  }
}

if (!outputPath || inputs.length === 0) {
  usage();
  process.exit(1);
}

function parseInputSpec(spec) {
  const separatorIndex = spec.lastIndexOf(":");
  if (separatorIndex <= 0 || separatorIndex === spec.length - 1 || spec.includes("://")) {
    const absPath = path.resolve(spec);
    return {
      sourcePath: absPath,
      sourceLabel: path.basename(absPath, path.extname(absPath)),
    };
  }

  const maybePath = spec.slice(0, separatorIndex);
  const maybeLabel = spec.slice(separatorIndex + 1);
  if (!maybePath || !maybeLabel) {
    const absPath = path.resolve(spec);
    return {
      sourcePath: absPath,
      sourceLabel: path.basename(absPath, path.extname(absPath)),
    };
  }

  return {
    sourcePath: path.resolve(maybePath),
    sourceLabel: maybeLabel,
  };
}

const mergedLines = [];
const sourceSummaries = [];

for (const inputSpec of inputs) {
  const { sourcePath, sourceLabel } = parseInputSpec(inputSpec);
  const lines = readFileSync(sourcePath, "utf8").split("\n").filter(Boolean);
  let episodeCount = 0;
  const episodeIds = new Set();

  for (const line of lines) {
    const row = JSON.parse(line);
    const originalEpisodeId = String(row.episode_id ?? "unknown");
    row.episode_id = `${originalEpisodeId}::${sourceLabel}`;
    row.meta = {
      ...(row.meta ?? {}),
      dataset_source: sourceLabel,
    };
    episodeIds.add(row.episode_id);
    mergedLines.push(JSON.stringify(row));
  }

  episodeCount = episodeIds.size;
  sourceSummaries.push({
    source: sourceLabel,
    rows: lines.length,
    episodes: episodeCount,
    path: sourcePath,
  });
}

const absOutputPath = path.resolve(outputPath);
mkdirSync(path.dirname(absOutputPath), { recursive: true });
writeFileSync(absOutputPath, mergedLines.join("\n") + "\n", { encoding: "utf8" });

const totalEpisodes = new Set(
  mergedLines.map(line => JSON.parse(line).episode_id),
).size;

console.log(`Output: ${absOutputPath}`);
console.log(`Rows: ${mergedLines.length}`);
console.log(`Episodes: ${totalEpisodes}`);
for (const summary of sourceSummaries) {
  console.log(
    `Source ${summary.source}: rows=${summary.rows} episodes=${summary.episodes} path=${summary.path}`,
  );
}
