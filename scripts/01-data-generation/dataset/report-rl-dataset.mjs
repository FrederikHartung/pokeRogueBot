import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

function usage() {
  console.error(
    "Usage: node scripts/01-data-generation/dataset/report-rl-dataset.mjs"
      + " --input <dataset.jsonl>"
      + " [--manifest <manifest.json> --phase <phase_name>]"
      + " [--output <report.json>]",
  );
}

const args = process.argv.slice(2);
let inputPath = null;
let outputPath = null;
let manifestPath = null;
let manifestPhase = null;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--input") {
    inputPath = args[i + 1] ?? null;
    i += 1;
    continue;
  }
  if (arg === "--output") {
    outputPath = args[i + 1] ?? null;
    i += 1;
    continue;
  }
  if (arg === "--manifest") {
    manifestPath = args[i + 1] ?? null;
    i += 1;
    continue;
  }
  if (arg === "--phase") {
    manifestPhase = args[i + 1] ?? null;
    i += 1;
  }
}

if (!inputPath) {
  usage();
  process.exit(1);
}

const absInputPath = path.resolve(inputPath);
if (!existsSync(absInputPath)) {
  console.error(`Dataset not found: ${absInputPath}`);
  process.exit(1);
}

const rows = await readJsonl(absInputPath);
const manifest = manifestPath ? readOptionalJson(path.resolve(manifestPath)) : null;
const report = buildDatasetReport(rows, manifest, manifestPhase);

if (outputPath) {
  const absOutputPath = path.resolve(outputPath);
  mkdirSync(path.dirname(absOutputPath), { recursive: true });
  writeFileSync(absOutputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report: ${absOutputPath}`);
}

console.log(`Dataset: ${absInputPath}`);
console.log(`Transitions: ${report.summary.transitions}`);
console.log(`Episodes: ${report.summary.episodes}`);
console.log(`Win rate: ${report.summary.win_rate.toFixed(3)}`);
console.log(`Avg reward: ${report.summary.avg_reward.toFixed(4)}`);
console.log(`Avg turns: ${report.summary.avg_turns.toFixed(2)}`);
console.log(`Avg switches: ${report.summary.avg_switches.toFixed(2)}`);
console.log(`Avg status moves: ${report.summary.avg_status_moves.toFixed(2)}`);

async function readJsonl(filePath) {
  const rows = [];
  const reader = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of reader) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    rows.push(JSON.parse(trimmed));
  }
  return rows;
}

function readOptionalJson(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function buildDatasetReport(rows, manifest, phaseName) {
  const episodes = groupEpisodes(rows);
  const summary = summarizeEpisodes(episodes);
  const perWave = summarizeDimension(episodes, episode => String(episode.wave ?? "unknown"));
  const perScenario = summarizeDimension(episodes, episode => String(episode.scenario ?? "unknown"));
  const actionSources = summarizeActionSources(rows);
  const durations = summarizeManifestDurations(manifest, phaseName);

  attachDurations(perWave, durations.byWave);
  attachDurations(perScenario, durations.byScenario);

  return {
    summary,
    action_sources: actionSources,
    per_wave: sortSummaryMap(perWave, compareNumericKeys),
    per_scenario: sortSummaryMap(perScenario, (left, right) => left.localeCompare(right)),
    generation: durations.summary,
  };
}

function groupEpisodes(rows) {
  const episodes = new Map();
  for (const row of rows) {
    const episodeId = String(row.episode_id ?? "unknown");
    const current = episodes.get(episodeId) ?? {
      episode_id: episodeId,
      wave: row?.meta?.wave ?? row?.state?.wave_index ?? null,
      scenario: row?.meta?.scenario ?? null,
      rows: [],
    };
    current.rows.push(row);
    episodes.set(episodeId, current);
  }

  for (const episode of episodes.values()) {
    episode.rows.sort((left, right) => Number(left.step_index ?? 0) - Number(right.step_index ?? 0));
    const last = episode.rows[episode.rows.length - 1] ?? {};
    episode.outcome = String(last?.meta?.outcome ?? "unknown");
    episode.reward = episode.rows.reduce((sum, row) => sum + Number(row.reward ?? 0), 0);
    episode.turns = episode.rows.length;
    episode.switches = episode.rows.filter(row => Number(row.action ?? -1) >= 4).length;
    episode.statusMoves = episode.rows.filter(isStatusMoveAction).length;
  }

  return Array.from(episodes.values());
}

function isStatusMoveAction(row) {
  const action = Number(row?.action ?? -1);
  if (action < 0 || action >= 4) {
    return false;
  }
  const move = row?.state?.moves?.[action];
  return Number(move?.move_kind_bucket ?? -1) === 0;
}

function summarizeEpisodes(episodes) {
  const result = {
    transitions: episodes.reduce((sum, episode) => sum + episode.rows.length, 0),
    episodes: episodes.length,
    wins: 0,
    losses: 0,
    timeouts: 0,
    truncated: 0,
    avg_reward: 0,
    avg_turns: 0,
    avg_switches: 0,
    avg_status_moves: 0,
    win_rate: 0,
  };

  for (const episode of episodes) {
    if (episode.outcome === "win") result.wins += 1;
    else if (episode.outcome === "loss") result.losses += 1;
    else if (episode.outcome === "timeout") result.timeouts += 1;
    else result.truncated += 1;

    result.avg_reward += episode.reward;
    result.avg_turns += episode.turns;
    result.avg_switches += episode.switches;
    result.avg_status_moves += episode.statusMoves;
  }

  if (episodes.length > 0) {
    result.avg_reward /= episodes.length;
    result.avg_turns /= episodes.length;
    result.avg_switches /= episodes.length;
    result.avg_status_moves /= episodes.length;
    result.win_rate = result.wins / episodes.length;
  }

  return result;
}

function summarizeDimension(episodes, keyFn) {
  const grouped = new Map();
  for (const episode of episodes) {
    const key = keyFn(episode);
    const bucket = grouped.get(key) ?? [];
    bucket.push(episode);
    grouped.set(key, bucket);
  }

  const summary = new Map();
  for (const [key, bucket] of grouped.entries()) {
    summary.set(key, summarizeEpisodes(bucket));
  }
  return summary;
}

function summarizeActionSources(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = String(row?.meta?.action_source ?? "unknown");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(Array.from(counts.entries()).sort((left, right) => left[0].localeCompare(right[0])));
}

function summarizeManifestDurations(manifest, phaseName) {
  const summary = {
    phase: phaseName ?? null,
    total_duration_ms: 0,
    completed_batches: 0,
  };
  const byWave = new Map();
  const byScenario = new Map();

  if (!manifest || !Array.isArray(manifest.batches)) {
    return { summary, byWave, byScenario };
  }

  for (const batch of manifest.batches) {
    if (phaseName && batch.phase !== phaseName) {
      continue;
    }
    if (batch.status !== "completed") {
      continue;
    }
    const durationMs = Number(batch.duration_ms ?? 0);
    summary.total_duration_ms += durationMs;
    summary.completed_batches += 1;

    const waveKey = String(batch.wave_index ?? "unknown");
    const scenarioKey = String(batch.scenario_name ?? "unknown");
    byWave.set(waveKey, (byWave.get(waveKey) ?? 0) + durationMs);
    byScenario.set(scenarioKey, (byScenario.get(scenarioKey) ?? 0) + durationMs);
  }

  return { summary, byWave, byScenario };
}

function attachDurations(summaryMap, durationMap) {
  for (const [key, summary] of summaryMap.entries()) {
    summary.generation_duration_ms = durationMap.get(key) ?? 0;
  }
}

function sortSummaryMap(map, comparator) {
  return Object.fromEntries(Array.from(map.entries()).sort((left, right) => comparator(left[0], right[0])));
}

function compareNumericKeys(left, right) {
  const leftNum = Number(left);
  const rightNum = Number(right);
  if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
    return leftNum - rightNum;
  }
  return left.localeCompare(right);
}
