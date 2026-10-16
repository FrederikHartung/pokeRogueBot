import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Modifier-Benchmark: vergleicht Policies auf denselben Seeds (docs/modifier-benchmark-design.md, Abschnitt 6).
// Liest die Roh-Outputs der Strategic-Collector-Pipeline (<runtime>/collect_dataset/batches/*.json) und schreibt
// modifier-benchmark-compare.json, eine Markdown-Tabelle und einen kurzen Text fuer Telegram.
//
// node scripts/03-benchmark/eval/compare-modifier-policies.ts \
//   --policy random_executable=<runtime-dir> --policy heuristic_v1=<runtime-dir> --baseline random_executable --out <dir>

/** Feste Kaempfe im Classic-Modus (pokerogue/src/enums/fixed-boss-waves.ts), soweit fuer Runs bis Welle 50 relevant. */
export const FIXED_BATTLE_WAVES: Readonly<Record<number, string>> = {
  5: "TOWN_YOUNGSTER",
  8: "RIVAL_1",
  25: "RIVAL_2",
  35: "EVIL_GRUNT_1",
};

const WASTED_FAMILIES = new Set(["ball", "lure"]);
const BOOTSTRAP_SAMPLES = 10_000;

export interface EpisodeSummary {
  seed: string;
  run_index: number;
  wave_reached: number;
  final_money: number | null;
  reward_picks: number;
  wasted_picks: number;
  fixed_battle_entries: { wave_index: number; party_hp_ratio_sum: number; alive_count: number }[];
}

export interface PolicyData {
  label: string;
  runtime_dir: string;
  modifier_policy: string | null;
  combat_dqn_checkpoint: string | null;
  max_waves: number | null;
  episodes: EpisodeSummary[];
  technical_terminations: number;
}

export interface PolicySummary {
  label: string;
  modifier_policy: string | null;
  runs: number;
  seeds: number;
  technical_terminations: number;
  mean_wave: number;
  median_wave: number;
  min_wave: number;
  max_wave: number;
  runs_at_max_waves: number;
  fixed_battles: { wave: number; name: string; reached: number; survived: number; survival_rate: number | null; mean_entry_hp: number | null }[];
  mean_final_money: number | null;
  wasted_pick_share: number | null;
}

export interface PairedComparison {
  baseline: string;
  candidate: string;
  paired_seeds: number;
  mean_diff: number;
  ci95_low: number;
  ci95_high: number;
  wins: number;
  ties: number;
  losses: number;
  verdict: "candidate_better" | "baseline_better" | "no_clear_difference";
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Deterministischer Zufall (mulberry32), damit das Konfidenzintervall bei gleichen Daten gleich bleibt. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 95-%-Intervall des Mittelwerts per Bootstrap ueber die Seed-Differenzen. */
export function bootstrapMeanCi(values: number[], samples = BOOTSTRAP_SAMPLES, seed = 1): [number, number] {
  if (values.length === 0) return [Number.NaN, Number.NaN];
  const random = createRandom(seed);
  const means: number[] = [];
  for (let sample = 0; sample < samples; sample += 1) {
    let sum = 0;
    for (let draw = 0; draw < values.length; draw += 1) {
      sum += values[Math.floor(random() * values.length)]!;
    }
    means.push(sum / values.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(samples * 0.025)]!, means[Math.min(samples - 1, Math.floor(samples * 0.975))]!];
}

/** Erreichte Welle pro Seed; bei mehreren Runs pro Seed (z. B. random) der Mittelwert. */
export function seedMeans(episodes: EpisodeSummary[]): Map<string, number> {
  const bySeed = new Map<string, number[]>();
  for (const episode of episodes) {
    bySeed.set(episode.seed, [...(bySeed.get(episode.seed) ?? []), episode.wave_reached]);
  }
  return new Map([...bySeed].map(([seed, waves]) => [seed, mean(waves)]));
}

export function summarizePolicy(data: PolicyData): PolicySummary {
  const waves = data.episodes.map(episode => episode.wave_reached);
  const finalMoney = data.episodes.map(episode => episode.final_money).filter((value): value is number => value !== null);
  const rewardPicks = data.episodes.reduce((sum, episode) => sum + episode.reward_picks, 0);
  const wastedPicks = data.episodes.reduce((sum, episode) => sum + episode.wasted_picks, 0);
  const fixedBattles = Object.entries(FIXED_BATTLE_WAVES).map(([waveText, name]) => {
    const wave = Number(waveText);
    // wave_reached zaehlt abgeschlossene Wellen: Welle W erreicht heisst wave_reached >= W - 1, ueberstanden >= W.
    const reached = data.episodes.filter(episode => episode.wave_reached >= wave - 1);
    const survived = reached.filter(episode => episode.wave_reached >= wave).length;
    const entryHp = data.episodes
      .flatMap(episode => episode.fixed_battle_entries)
      .filter(entry => entry.wave_index === wave)
      .map(entry => entry.party_hp_ratio_sum);
    return {
      wave,
      name,
      reached: reached.length,
      survived,
      survival_rate: reached.length > 0 ? survived / reached.length : null,
      mean_entry_hp: entryHp.length > 0 ? mean(entryHp) : null,
    };
  });
  return {
    label: data.label,
    modifier_policy: data.modifier_policy,
    runs: data.episodes.length,
    seeds: new Set(data.episodes.map(episode => episode.seed)).size,
    technical_terminations: data.technical_terminations,
    mean_wave: waves.length > 0 ? mean(waves) : Number.NaN,
    median_wave: waves.length > 0 ? median(waves) : Number.NaN,
    min_wave: waves.length > 0 ? Math.min(...waves) : Number.NaN,
    max_wave: waves.length > 0 ? Math.max(...waves) : Number.NaN,
    runs_at_max_waves: data.max_waves === null ? 0 : waves.filter(wave => wave >= data.max_waves!).length,
    fixed_battles: fixedBattles,
    mean_final_money: finalMoney.length > 0 ? mean(finalMoney) : null,
    wasted_pick_share: rewardPicks > 0 ? wastedPicks / rewardPicks : null,
  };
}

/** Gepaarter Vergleich ueber Seeds, die beide Policies haben; Differenz = Kandidat - Baseline. */
export function comparePaired(baseline: PolicyData, candidate: PolicyData): PairedComparison {
  const baseMeans = seedMeans(baseline.episodes);
  const candidateMeans = seedMeans(candidate.episodes);
  const diffs: number[] = [];
  for (const [seed, candidateWave] of candidateMeans) {
    const baseWave = baseMeans.get(seed);
    if (baseWave !== undefined) diffs.push(candidateWave - baseWave);
  }
  const [low, high] = bootstrapMeanCi(diffs);
  const verdict = low > 0 ? "candidate_better" : high < 0 ? "baseline_better" : "no_clear_difference";
  return {
    baseline: baseline.label,
    candidate: candidate.label,
    paired_seeds: diffs.length,
    mean_diff: diffs.length > 0 ? mean(diffs) : Number.NaN,
    ci95_low: low,
    ci95_high: high,
    wins: diffs.filter(diff => diff > 0).length,
    ties: diffs.filter(diff => diff === 0).length,
    losses: diffs.filter(diff => diff < 0).length,
    verdict,
  };
}

type JsonRecord = Record<string, unknown>;

function summarizeEpisode(episode: JsonRecord): EpisodeSummary {
  const steps = (episode.steps as JsonRecord[] | undefined) ?? [];
  let rewardPicks = 0;
  let wastedPicks = 0;
  let finalMoney: number | null = null;
  for (const step of steps) {
    const transition = step.modifier_transition as JsonRecord | undefined;
    if (!transition) continue;
    const state = transition.state as { run?: { money?: number } } | undefined;
    finalMoney = state?.run?.money ?? finalMoney;
    const candidates = transition.candidates as JsonRecord[];
    const selected = candidates[Number(transition.selected_candidate_index)];
    if (selected?.kind === "take_reward") {
      rewardPicks += 1;
      if (WASTED_FAMILIES.has(String(selected.item_family))) wastedPicks += 1;
    }
  }
  return {
    seed: String(episode.seed),
    run_index: Number(episode.run_index),
    wave_reached: Number(episode.wave_reached),
    final_money: finalMoney,
    reward_picks: rewardPicks,
    wasted_picks: wastedPicks,
    fixed_battle_entries: (episode.fixed_battle_entries as EpisodeSummary["fixed_battle_entries"] | undefined) ?? [],
  };
}

export function loadPolicyData(label: string, runtimeDir: string): PolicyData {
  const batchesDir = path.join(runtimeDir, "collect_dataset", "batches");
  if (!existsSync(batchesDir)) {
    throw new Error(`No batch outputs found: ${batchesDir}`);
  }
  const outputs = readdirSync(batchesDir)
    .filter(name => name.endsWith(".json"))
    .sort()
    .map(name => JSON.parse(readFileSync(path.join(batchesDir, name), "utf8")) as JsonRecord);
  const episodes = outputs.flatMap(output => ((output.episodes as JsonRecord[] | undefined) ?? []).map(summarizeEpisode));
  const withEpisodes = outputs.find(output => ((output.episodes as unknown[] | undefined) ?? []).length > 0);
  return {
    label,
    runtime_dir: runtimeDir,
    modifier_policy: (withEpisodes?.modifier_policy as string | undefined) ?? null,
    combat_dqn_checkpoint: (withEpisodes?.combat_dqn_checkpoint as string | undefined) ?? null,
    max_waves: (withEpisodes?.max_waves as number | undefined) ?? null,
    episodes,
    technical_terminations: outputs.reduce((sum, output) => sum + Number(output.technical_termination_count ?? 0), 0),
  };
}

function format(value: number | null, digits = 2): string {
  return value === null || Number.isNaN(value) ? "-" : value.toFixed(digits);
}

function formatRate(value: number | null): string {
  return value === null ? "-" : `${Math.round(value * 100)} %`;
}

export function renderMarkdown(summaries: PolicySummary[], comparisons: PairedComparison[]): string {
  const lines = [
    "| Policy | Runs | Seeds | Welle Mittel | Median | Min-Max | Rivale W8 | Rivale W25 | HP vor W8 | Geld am Ende | Baelle/Lockmittel | techn. Abbrueche |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const summary of summaries) {
    const rival1 = summary.fixed_battles.find(entry => entry.wave === 8);
    const rival2 = summary.fixed_battles.find(entry => entry.wave === 25);
    lines.push(
      `| ${summary.label} | ${summary.runs} | ${summary.seeds} | ${format(summary.mean_wave)} | ${format(summary.median_wave, 1)} | ${summary.min_wave}-${summary.max_wave} | ${formatRate(rival1?.survival_rate ?? null)} | ${formatRate(rival2?.survival_rate ?? null)} | ${format(rival1?.mean_entry_hp ?? null)} | ${format(summary.mean_final_money, 0)} | ${formatRate(summary.wasted_pick_share)} | ${summary.technical_terminations} |`,
    );
  }
  lines.push("", "| Vergleich | Seeds | Differenz Welle | 95-%-KI | besser / gleich / schlechter | Urteil |", "|---|---|---|---|---|---|");
  for (const comparison of comparisons) {
    lines.push(
      `| ${comparison.candidate} vs ${comparison.baseline} | ${comparison.paired_seeds} | ${format(comparison.mean_diff)} | [${format(comparison.ci95_low)}, ${format(comparison.ci95_high)}] | ${comparison.wins} / ${comparison.ties} / ${comparison.losses} | ${comparison.verdict} |`,
    );
  }
  return lines.join("\n") + "\n";
}

const VERDICT_TEXT: Record<PairedComparison["verdict"], string> = {
  candidate_better: "klar besser",
  baseline_better: "klar schlechter",
  no_clear_difference: "kein klarer Unterschied",
};

export function renderTelegramText(summaries: PolicySummary[], comparisons: PairedComparison[]): string {
  const lines = ["Modifier-Benchmark fertig", ""];
  for (const summary of summaries) {
    const rival1 = summary.fixed_battles.find(entry => entry.wave === 8);
    const rival2 = summary.fixed_battles.find(entry => entry.wave === 25);
    lines.push(
      `${summary.label}: Welle ${format(summary.mean_wave, 1)} im Mittel (Median ${format(summary.median_wave, 1)}, ${summary.min_wave}-${summary.max_wave}), ${summary.runs} Runs`,
      `  Rivale W8 ueberlebt: ${formatRate(rival1?.survival_rate ?? null)}, HP vor W8: ${format(rival1?.mean_entry_hp ?? null)} / 3`,
      `  Rivale W25 ueberlebt: ${formatRate(rival2?.survival_rate ?? null)}, techn. Abbrueche: ${summary.technical_terminations}`,
    );
  }
  for (const comparison of comparisons) {
    lines.push(
      "",
      `${comparison.candidate} vs ${comparison.baseline}: ${comparison.mean_diff >= 0 ? "+" : ""}${format(comparison.mean_diff)} Wellen pro Seed`,
      `  95-%-KI [${format(comparison.ci95_low)}, ${format(comparison.ci95_high)}], besser/gleich/schlechter ${comparison.wins}/${comparison.ties}/${comparison.losses}`,
      `  Urteil: ${VERDICT_TEXT[comparison.verdict]}`,
    );
  }
  return lines.join("\n") + "\n";
}

function parseArgs(argv: string[]): { policies: [string, string][]; baseline: string | null; out: string } {
  const policies: [string, string][] = [];
  let baseline: string | null = null;
  let out = "data/temp/rl/modifier-benchmark";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--policy" && next) {
      const separator = next.indexOf("=");
      if (separator <= 0) throw new Error(`Expected --policy <label>=<runtime-dir>, got ${next}`);
      policies.push([next.slice(0, separator), next.slice(separator + 1)]);
      index += 1;
    } else if (arg === "--baseline" && next) {
      baseline = next;
      index += 1;
    } else if (arg === "--out" && next) {
      out = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (policies.length === 0) throw new Error("At least one --policy <label>=<runtime-dir> is required");
  return { policies, baseline, out };
}

function main(): void {
  const { policies, baseline, out } = parseArgs(process.argv.slice(2));
  const data = policies.map(([label, runtimeDir]) => loadPolicyData(label, path.resolve(runtimeDir)));
  const summaries = data.map(summarizePolicy);
  const baselineData = baseline ? data.find(entry => entry.label === baseline) : undefined;
  if (baseline && !baselineData) throw new Error(`Baseline ${baseline} is not among the policies`);
  const comparisons = baselineData
    ? data.filter(entry => entry !== baselineData).map(entry => comparePaired(baselineData, entry))
    : [];

  mkdirSync(out, { recursive: true });
  const result = {
    generated_at: new Date().toISOString(),
    policies: data.map(entry => ({
      label: entry.label,
      runtime_dir: entry.runtime_dir,
      modifier_policy: entry.modifier_policy,
      combat_dqn_checkpoint: entry.combat_dqn_checkpoint,
      max_waves: entry.max_waves,
    })),
    summaries,
    comparisons,
  };
  writeFileSync(path.join(out, "modifier-benchmark-compare.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
  const markdown = renderMarkdown(summaries, comparisons);
  writeFileSync(path.join(out, "modifier-benchmark-compare.md"), markdown, "utf8");
  writeFileSync(path.join(out, "modifier-benchmark-telegram.txt"), renderTelegramText(summaries, comparisons), "utf8");
  console.log(markdown);
  console.log(`Written to ${path.resolve(out)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
