import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));

if (!args.manifest) {
  throw new Error("Missing required --manifest <path>");
}

const manifestPath = path.resolve(args.manifest);
if (!existsSync(manifestPath)) {
  throw new Error(`Manifest not found: ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const summary = buildSummary(manifest, manifestPath);

if (args.output) {
  const outputPath = path.resolve(args.output);
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`Runtime summary written to ${outputPath}`);
}

printSummary(summary);

function parseArgs(argv) {
  const parsed = {
    manifest: null,
    output: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--manifest") {
      parsed.manifest = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--output") {
      parsed.output = argv[i + 1] ?? null;
      i += 1;
    }
  }

  return parsed;
}

function buildSummary(manifest, manifestPath) {
  const orderedSteps = Object.entries(manifest.steps ?? {})
    .map(([name, step]) => ({
      name,
      ...step,
    }))
    .sort(compareSteps);

  const fallbackDurations = inferFallbackDurations(orderedSteps, manifest);
  const steps = orderedSteps.map((step, index) => {
    const durationMs = Number.isFinite(step.duration_ms)
      ? step.duration_ms
      : (fallbackDurations.get(step.name) ?? null);
    return {
      order: index,
      name: step.name,
      status: step.status ?? "unknown",
      started_at: step.started_at ?? null,
      completed_at: step.completed_at ?? null,
      duration_ms: durationMs,
      duration_human: formatDuration(durationMs),
      category: categorizeStep(step.name),
      iteration: resolveIteration(step.name),
    };
  });

  const totals = {
    total_steps: steps.length,
    completed_steps: steps.filter(step => step.status === "completed").length,
    total_duration_ms: sumDefined(steps.map(step => step.duration_ms)),
    total_duration_human: formatDuration(sumDefined(steps.map(step => step.duration_ms))),
  };

  const categories = aggregateByKey(steps, step => step.category);
  const iterations = aggregateByKey(
    steps.filter(step => step.iteration != null),
    step => String(step.iteration),
  );

  return {
    manifest_path: manifestPath,
    created_at: manifest.created_at ?? null,
    updated_at: manifest.updated_at ?? null,
    totals,
    categories,
    iterations,
    steps,
  };
}

function compareSteps(left, right) {
  const leftTime = Date.parse(left.completed_at ?? left.updated_at ?? left.started_at ?? "");
  const rightTime = Date.parse(right.completed_at ?? right.updated_at ?? right.started_at ?? "");
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.name.localeCompare(right.name);
}

function inferFallbackDurations(steps, manifest) {
  const result = new Map();
  const stepBatches = groupBatchesByPhase(manifest.batches ?? []);

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const batches = stepBatches.get(step.name) ?? [];
    if (batches.length > 0) {
      const batchDuration = sumDefined(batches.map(batch => batch.duration_ms));
      if (batchDuration > 0) {
        result.set(step.name, batchDuration);
        continue;
      }
    }

    const previousTime = index === 0
      ? Date.parse(manifest.created_at ?? "")
      : Date.parse(steps[index - 1].completed_at ?? steps[index - 1].updated_at ?? "");
    const currentTime = Date.parse(step.completed_at ?? step.updated_at ?? "");
    if (Number.isFinite(previousTime) && Number.isFinite(currentTime) && currentTime >= previousTime) {
      result.set(step.name, currentTime - previousTime);
    }
  }

  return result;
}

function groupBatchesByPhase(batches) {
  const grouped = new Map();
  for (const batch of batches) {
    const phase = batch.phase;
    if (typeof phase !== "string") {
      continue;
    }
    const bucket = grouped.get(phase) ?? [];
    bucket.push(batch);
    grouped.set(phase, bucket);
  }
  return grouped;
}

function aggregateByKey(steps, keySelector) {
  const grouped = new Map();

  for (const step of steps) {
    const key = keySelector(step);
    const bucket = grouped.get(key) ?? {
      key,
      steps: 0,
      duration_ms: 0,
    };
    bucket.steps += 1;
    bucket.duration_ms += step.duration_ms ?? 0;
    grouped.set(key, bucket);
  }

  return Array.from(grouped.values())
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(bucket => ({
      ...bucket,
      duration_human: formatDuration(bucket.duration_ms),
    }));
}

function categorizeStep(name) {
  if (name.includes("collect")) {
    return "collect";
  }
  if (name.includes("train")) {
    return "train";
  }
  if (name.includes("benchmark")) {
    return "benchmark";
  }
  if (name.includes("report")) {
    return "report";
  }
  if (name.includes("merge")) {
    return "merge";
  }
  return "other";
}

function resolveIteration(name) {
  if (name.startsWith("benchmark_baseline") || name.startsWith("train_baseline") || name.startsWith("baseline_")) {
    return 0;
  }
  const match = name.match(/_(\d+)$/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
}

function sumDefined(values) {
  return values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "unknown";
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${String(remMinutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function printSummary(summary) {
  console.log(`Manifest: ${summary.manifest_path}`);
  console.log(`Total duration: ${summary.totals.total_duration_human}`);
  console.log(`Completed steps: ${summary.totals.completed_steps}/${summary.totals.total_steps}`);
  console.log("");
  console.log("Category totals:");
  for (const category of summary.categories) {
    console.log(`- ${category.key}: ${category.duration_human} across ${category.steps} steps`);
  }
  console.log("");
  console.log("Iteration totals:");
  for (const iteration of summary.iterations) {
    console.log(`- iteration ${iteration.key}: ${iteration.duration_human} across ${iteration.steps} steps`);
  }
  console.log("");
  console.log("Steps:");
  for (const step of summary.steps) {
    console.log(`- ${step.name}: ${step.duration_human} [${step.status}]`);
  }
}
