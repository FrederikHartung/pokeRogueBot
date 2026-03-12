import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

if (isExecutedDirectly()) {
  const profileArg = process.argv[2];
  if (!profileArg) {
    throw new Error("Missing profile config path");
  }

  const cliOptions = parseCliOptions(process.argv.slice(3));
  const result = runProfileCollector(path.resolve(profileArg), cliOptions);
  if (result.statusCode !== 0) {
    process.exit(result.statusCode);
  }
}

export function runProfileCollector(profilePath, options = {}) {
  if (!existsSync(profilePath)) {
    throw new Error(`Wave-library collector profile not found: ${profilePath}`);
  }

  const profile = JSON.parse(readFileSync(profilePath, "utf8"));
  const profileDir = path.dirname(profilePath);
  const scenarioFiles = resolveScenarioFiles(profile, profileDir);
  const includeWaves = toNumberSet(profile.include_waves);
  const excludeWaves = toNumberSet(profile.exclude_waves);
  const maxScenariosPerWave = Number.isInteger(profile.max_scenarios_per_wave)
    ? profile.max_scenarios_per_wave
    : Number.POSITIVE_INFINITY;
  const selectionMode = typeof profile.selection_mode === "string"
    ? profile.selection_mode
    : "stable";
  const selectionSeed = profile.selection_seed ?? 42;

  if (scenarioFiles.length === 0) {
    throw new Error(`No scenario files resolved for profile: ${profilePath}`);
  }

  const selected = selectScenarioFiles({
    scenarioFiles,
    includeWaves,
    excludeWaves,
    maxScenariosPerWave,
    selectionMode,
    selectionSeed,
  });

  if (selected.files.length === 0) {
    throw new Error(`Profile selected no scenarios: ${profilePath}`);
  }

  const materializedRunConfigPath = resolveOutputPath(
    profile.materialized_run_config_path ?? "./generated/collector-run-wave-library-profile.json",
    profileDir,
  );
  mkdirSync(path.dirname(materializedRunConfigPath), { recursive: true });

  const collectorConfig = buildCollectorConfig(profile, profileDir, selected.files);
  writeFileSync(materializedRunConfigPath, `${JSON.stringify(collectorConfig, null, 2)}\n`, "utf8");

  logSelectionSummary({
    profilePath,
    materializedRunConfigPath,
    selected,
    collectorConfig,
  });

  if (options.prepareOnly === true) {
    return { statusCode: 0, materializedRunConfigPath, selected };
  }

  const collectorScriptPath = path.join(repoRoot, "scripts", "run-pokerogue-experience-collector.mjs");
  const collectorResult = spawnSync("node", [collectorScriptPath, materializedRunConfigPath], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  return {
    statusCode: collectorResult.status ?? 1,
    materializedRunConfigPath,
    selected,
  };
}

function isExecutedDirectly() {
  const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
  return entryPath === __filename;
}

function parseCliOptions(args) {
  return {
    prepareOnly: args.includes("--prepare-only"),
  };
}

function resolveScenarioFiles(profile, profileDir) {
  const resolved = [];

  if (Array.isArray(profile.scenario_dirs)) {
    for (const dirEntry of profile.scenario_dirs) {
      if (typeof dirEntry !== "string") {
        continue;
      }
      const fullDir = path.isAbsolute(dirEntry) ? dirEntry : path.resolve(profileDir, dirEntry);
      if (!existsSync(fullDir)) {
        continue;
      }
      const names = readdirSync(fullDir)
        .filter(name => name.endsWith(".json"))
        .sort((left, right) => left.localeCompare(right));
      for (const name of names) {
        resolved.push(path.join(fullDir, name));
      }
    }
  }

  if (Array.isArray(profile.scenario_files)) {
    for (const fileEntry of profile.scenario_files) {
      if (typeof fileEntry !== "string") {
        continue;
      }
      resolved.push(path.isAbsolute(fileEntry) ? fileEntry : path.resolve(profileDir, fileEntry));
    }
  }

  return Array.from(new Set(resolved));
}

function selectScenarioFiles({
  scenarioFiles,
  includeWaves,
  excludeWaves,
  maxScenariosPerWave,
  selectionMode,
  selectionSeed,
}) {
  const grouped = new Map();

  for (const scenarioPath of scenarioFiles) {
    const raw = JSON.parse(readFileSync(scenarioPath, "utf8"));
    const waveIndex = Number(raw.wave_index);
    if (!Number.isInteger(waveIndex)) {
      continue;
    }
    if (includeWaves.size > 0 && !includeWaves.has(waveIndex)) {
      continue;
    }
    if (excludeWaves.has(waveIndex)) {
      continue;
    }

    const bucket = grouped.get(waveIndex) ?? [];
    bucket.push({
      path: scenarioPath,
      waveIndex,
      difficultyGroup: String(raw.difficulty_group ?? "core"),
      battleType: String(raw.battle_type ?? "UNKNOWN"),
    });
    grouped.set(waveIndex, bucket);
  }

  const selectedFiles = [];
  const selectedPerWave = [];

  for (const waveIndex of Array.from(grouped.keys()).sort((left, right) => left - right)) {
    const sortedItems = grouped.get(waveIndex)
      .slice()
      .sort(compareScenarioEntries);
    const items = selectPerWaveItems(sortedItems, waveIndex, maxScenariosPerWave, selectionMode, selectionSeed);
    selectedPerWave.push({ waveIndex, count: items.length });
    for (const item of items) {
      selectedFiles.push(item.path);
    }
  }

  return {
    files: selectedFiles,
    perWave: selectedPerWave,
  };
}

function selectPerWaveItems(items, waveIndex, maxScenariosPerWave, selectionMode, selectionSeed) {
  if (items.length <= maxScenariosPerWave) {
    return items;
  }

  if (selectionMode === "random_per_wave") {
    return shuffleDeterministic(items, `${selectionSeed}::wave:${waveIndex}`).slice(0, maxScenariosPerWave);
  }

  return items.slice(0, maxScenariosPerWave);
}

function compareScenarioEntries(left, right) {
  const difficultyRankDelta = difficultyRank(left.difficultyGroup) - difficultyRank(right.difficultyGroup);
  if (difficultyRankDelta !== 0) {
    return difficultyRankDelta;
  }

  const battleTypeDelta = left.battleType.localeCompare(right.battleType);
  if (battleTypeDelta !== 0) {
    return battleTypeDelta;
  }

  return left.path.localeCompare(right.path);
}

function difficultyRank(group) {
  if (group === "hard") {
    return 0;
  }
  if (group === "benchmark") {
    return 1;
  }
  return 2;
}

function shuffleDeterministic(values, seedInput) {
  const result = values.slice();
  const random = createDeterministicRandom(seedInput);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createDeterministicRandom(seedInput) {
  let state = hashSeed(seedInput);
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seedInput) {
  const text = String(seedInput);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildCollectorConfig(profile, profileDir, selectedFiles) {
  const collectorConfig = { ...(profile.collector ?? {}) };
  collectorConfig.scenario_files = selectedFiles;

  if (typeof collectorConfig.output_path === "string") {
    collectorConfig.output_path = resolveOutputPath(collectorConfig.output_path, profileDir);
  }

  return collectorConfig;
}

function resolveOutputPath(value, baseDir) {
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function logSelectionSummary({ profilePath, materializedRunConfigPath, selected, collectorConfig }) {
  const episodesPerSeed = Number.isInteger(collectorConfig.episodes_per_seed)
    ? collectorConfig.episodes_per_seed
    : 1;
  const totalScenarioCount = selected.files.length;
  const estimatedEpisodes = totalScenarioCount * episodesPerSeed;

  console.log(`Wave-library collector profile: ${profilePath}`);
  console.log(`Materialized collector config: ${materializedRunConfigPath}`);
  console.log(`Selected scenarios: ${totalScenarioCount}`);
  console.log(`episodes_per_seed: ${episodesPerSeed}`);
  console.log(`Planned episodes: ${estimatedEpisodes}`);
  for (const entry of selected.perWave) {
    console.log(`Selected wave ${entry.waveIndex}: ${entry.count}`);
  }
}

function toNumberSet(values) {
  if (!Array.isArray(values)) {
    return new Set();
  }
  const normalized = values
    .map(value => Number(value))
    .filter(value => Number.isInteger(value));
  return new Set(normalized);
}
