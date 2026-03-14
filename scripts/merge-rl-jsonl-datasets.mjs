import { appendFileSync, createReadStream, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

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

const sourceSummaries = [];
let totalRows = 0;
const totalEpisodeIds = new Set();

const absOutputPath = path.resolve(outputPath);
mkdirSync(path.dirname(absOutputPath), { recursive: true });
writeFileSync(absOutputPath, "", { encoding: "utf8" });

for (const inputSpec of inputs) {
  const { sourcePath, sourceLabel } = parseInputSpec(inputSpec);
  let rowCount = 0;
  const episodeIds = new Set();
  const reader = readline.createInterface({
    input: createReadStream(sourcePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of reader) {
    if (!line) {
      continue;
    }
    const row = JSON.parse(line);
    const originalEpisodeId = String(row.episode_id ?? "unknown");
    row.episode_id = `${originalEpisodeId}::${sourceLabel}`;
    row.meta = {
      ...(row.meta ?? {}),
      dataset_source: sourceLabel,
    };
    episodeIds.add(row.episode_id);
    totalEpisodeIds.add(row.episode_id);
    appendFileSync(absOutputPath, `${JSON.stringify(row)}\n`, { encoding: "utf8" });
    rowCount += 1;
    totalRows += 1;
  }

  sourceSummaries.push({
    source: sourceLabel,
    rows: rowCount,
    episodes: episodeIds.size,
    path: sourcePath,
  });
}

console.log(`Output: ${absOutputPath}`);
console.log(`Rows: ${totalRows}`);
console.log(`Episodes: ${totalEpisodeIds.size}`);
for (const summary of sourceSummaries) {
  console.log(
    `Source ${summary.source}: rows=${summary.rows} episodes=${summary.episodes} path=${summary.path}`,
  );
}
