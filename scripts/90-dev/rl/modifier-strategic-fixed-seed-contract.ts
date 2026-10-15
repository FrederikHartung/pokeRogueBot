import { modifierTransitionV1Errors } from "./modifier-transition-v1-schema.ts";

/** v2: Steps tragen einen modifier-transition-v1-Datensatz statt durchnummerierter Aktionen. */
export const MODIFIER_STRATEGIC_OUTPUT_SCHEMA_VERSION = "modifier_strategic_fixed_seed_output_v2";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeContext(context: string): string {
  return context.length > 0 ? ` for ${context}` : "";
}

function assertPlainObject(value: unknown, context: string, label: string): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`${label}${describeContext(context)} must be an object`);
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  context: string,
  label: string,
): void {
  const unknownKeys = Object.keys(value).filter(key => !allowedKeys.has(key));
  if (unknownKeys.length === 0) {
    return;
  }
  throw new Error(`Unsupported ${label} field(s)${describeContext(context)}: ${unknownKeys.join(", ")}`);
}

function assertString(value: unknown, context: string, fieldName: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid string field${describeContext(context)}: ${fieldName}`);
  }
}

function assertNumber(value: unknown, context: string, fieldName: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric field${describeContext(context)}: ${fieldName}`);
  }
}

function assertInteger(value: unknown, context: string, fieldName: string, { min = 0 }: { min?: number } = {}): void {
  if (!Number.isInteger(value) || (value as number) < min) {
    throw new Error(`Invalid integer field${describeContext(context)}: ${fieldName}`);
  }
}

function assertStringArray(value: unknown, context: string, fieldName: string): void {
  if (!Array.isArray(value) || value.length === 0 || value.some(entry => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`Invalid string-array field${describeContext(context)}: ${fieldName}`);
  }
}

function assertArray(value: unknown, context: string, fieldName: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid array field${describeContext(context)}: ${fieldName}`);
  }
}

function validateSummary(value: unknown, context: string): Record<string, unknown> {
  assertPlainObject(value, context, "summary");
  assertAllowedKeys(
    value,
    new Set(["average_wave_reached", "average_total_reward", "best_wave_reached", "worst_wave_reached"]),
    context,
    "summary",
  );
  assertNumber(value.average_wave_reached, context, "average_wave_reached");
  assertNumber(value.average_total_reward, context, "average_total_reward");
  assertNumber(value.best_wave_reached, context, "best_wave_reached");
  assertNumber(value.worst_wave_reached, context, "worst_wave_reached");
  return structuredClone(value);
}

/** modifier-transition-v1 (JSON-Schema) plus: der gewaehlte Kandidat existiert und war waehlbar. */
function validateModifierTransition(value: unknown, context: string): void {
  assertPlainObject(value, context, "modifier_transition");
  const errors = modifierTransitionV1Errors(value);
  if (errors !== null) {
    throw new Error(`Invalid modifier_transition${describeContext(context)}: ${errors}`);
  }
  const candidates = value.candidates as Array<{ mask: number }>;
  const selected = candidates[value.selected_candidate_index as number];
  if (!selected || selected.mask !== 1) {
    throw new Error(`selected_candidate_index must point to a candidate with mask=1${describeContext(context)}`);
  }
}

function validateModifierStep(value: unknown, context: string): Record<string, unknown> {
  assertPlainObject(value, context, "modifier step");
  assertAllowedKeys(
    value,
    new Set([
      "step_index",
      "worker_id",
      "decision_rng_seed",
      "wave_index",
      "combat_turns",
      "modifier_transition",
    ]),
    context,
    "modifier step",
  );
  assertInteger(value.step_index, context, "step_index");
  assertString(value.worker_id, context, "worker_id");
  assertString(value.decision_rng_seed, context, "decision_rng_seed");
  assertInteger(value.wave_index, context, "wave_index");
  assertArray(value.combat_turns, context, "combat_turns");
  validateModifierTransition(value.modifier_transition, context);
  return structuredClone(value);
}

function validateEpisode(value: unknown, context: string): Record<string, unknown> {
  assertPlainObject(value, context, "episode");
  assertAllowedKeys(
    value,
    new Set([
      "schema_version",
      "run_index",
      "worker_id",
      "decision_rng_seed",
      "seed",
      "max_waves",
      "collector_variant",
      "modifier_policy",
      "runtime_ms",
      "completed_waves",
      "wave_reached",
      "termination_reason",
      "local_reward_sum",
      "terminal_reward",
      "total_reward",
      "steps",
      "fixed_battle_entries",
      "retry_count",
      "timeout_debug",
      "error_debug",
      "error_stack",
    ]),
    context,
    "episode",
  );
  assertString(value.schema_version, context, "schema_version");
  assertInteger(value.run_index, context, "run_index");
  assertString(value.worker_id, context, "worker_id");
  assertString(value.decision_rng_seed, context, "decision_rng_seed");
  assertString(value.seed, context, "seed");
  assertInteger(value.max_waves, context, "max_waves", { min: 1 });
  assertString(value.collector_variant, context, "collector_variant");
  assertString(value.modifier_policy, context, "modifier_policy");
  assertNumber(value.runtime_ms, context, "runtime_ms");
  assertInteger(value.completed_waves, context, "completed_waves");
  assertInteger(value.wave_reached, context, "wave_reached");
  assertString(value.termination_reason, context, "termination_reason");
  assertNumber(value.local_reward_sum, context, "local_reward_sum");
  assertNumber(value.terminal_reward, context, "terminal_reward");
  assertNumber(value.total_reward, context, "total_reward");
  assertArray(value.steps, context, "steps");
  // Optional: Ausgaben von vor dem Modifier-Benchmark haben das Feld nicht.
  if (value.fixed_battle_entries !== undefined) {
    assertArray(value.fixed_battle_entries, context, "fixed_battle_entries");
    value.fixed_battle_entries.forEach((entry, index) => {
      const entryContext = `${context}.fixed_battle_entries[${index}]`;
      assertPlainObject(entry, entryContext, "fixed_battle_entry");
      assertInteger(entry.wave_index, entryContext, "wave_index", { min: 1 });
      assertNumber(entry.party_hp_ratio_sum, entryContext, "party_hp_ratio_sum");
      assertInteger(entry.alive_count, entryContext, "alive_count");
    });
  }
  if (value.retry_count !== undefined) {
    assertInteger(value.retry_count, context, "retry_count");
  }
  if (value.timeout_debug !== undefined) {
    assertPlainObject(value.timeout_debug, context, "timeout_debug");
  }
  if (value.error_debug !== undefined) {
    assertPlainObject(value.error_debug, context, "error_debug");
  }
  if (value.error_stack !== undefined) {
    assertString(value.error_stack, context, "error_stack");
  }
  value.steps.forEach((step, index) => validateModifierStep(step, `${context}.steps[${index}]`));
  return structuredClone(value);
}

function validateTechnicalTerminationFields(value: Record<string, unknown>, context: string): void {
  if ("regular_run_count" in value) {
    assertInteger(value.regular_run_count, context, "regular_run_count");
  }
  if ("technical_termination_count" in value) {
    assertInteger(value.technical_termination_count, context, "technical_termination_count");
  }
  if (!("technical_terminations" in value)) {
    return;
  }
  assertArray(value.technical_terminations, context, "technical_terminations");
  value.technical_terminations.forEach((entry, index) => {
    const entryContext = `${context}.technical_terminations[${index}]`;
    assertPlainObject(entry, entryContext, "technical termination");
    assertAllowedKeys(entry, new Set(["run_index", "kind", "reason", "exit_code", "signal", "episode"]), entryContext, "technical termination");
    assertInteger(entry.run_index, entryContext, "run_index");
    assertString(entry.kind, entryContext, "kind");
    assertString(entry.reason, entryContext, "reason");
  });
  if (
    "technical_termination_count" in value
    && value.technical_termination_count !== value.technical_terminations.length
  ) {
    throw new Error(`technical_termination_count does not match technical_terminations${describeContext(context)}`);
  }
}

export function validateModifierStrategicFixedSeedOutput(value: unknown): Record<string, unknown> {
  const context = "modifier strategic fixed-seed output";
  assertPlainObject(value, context, "output");
  assertAllowedKeys(
    value,
    new Set([
      "schema_version",
      "seed",
      "run_count",
      "max_waves",
      "collector_variant",
      "worker_id",
      "starter_config_id",
      "starter_species",
      "decision_rng_strategy",
      "step_timeout_ms",
      "modifier_policy",
      "max_shop_purchases_per_phase",
      "max_rerolls_per_wave",
      "combat_dqn_checkpoint",
      "combat_dqn_device",
      "generated_at",
      "episodes",
      "summary",
      "regular_run_count",
      "technical_termination_count",
      "technical_terminations",
    ]),
    context,
    "output",
  );

  validateTechnicalTerminationFields(value, context);
  assertArray(value.episodes, context, "episodes");
  if (value.episodes.length === 0) {
    // Batch, in dem jeder Run technisch beendet wurde: es gibt keine Episode, aus der die
    // Metadaten stammen koennten. Solche Ausgaben traegt nur die Pipeline-Fehlererfassung weiter.
    assertString(value.seed, context, "seed");
    assertInteger(value.run_count, context, "run_count", { min: 1 });
    if (!Array.isArray(value.technical_terminations) || value.technical_terminations.length === 0) {
      throw new Error(`Output without episodes must list technical_terminations${describeContext(context)}`);
    }
    return structuredClone(value);
  }

  assertString(value.schema_version, context, "schema_version");
  if (value.schema_version !== MODIFIER_STRATEGIC_OUTPUT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schema_version${describeContext(context)}: ${String(value.schema_version)}`);
  }
  assertString(value.seed, context, "seed");
  assertInteger(value.run_count, context, "run_count", { min: 1 });
  assertInteger(value.max_waves, context, "max_waves", { min: 1 });
  assertString(value.collector_variant, context, "collector_variant");
  assertString(value.worker_id, context, "worker_id");
  assertString(value.starter_config_id, context, "starter_config_id");
  assertStringArray(value.starter_species, context, "starter_species");
  assertString(value.decision_rng_strategy, context, "decision_rng_strategy");
  if (value.decision_rng_strategy !== "seed_plus_run_index") {
    throw new Error(`Unsupported decision_rng_strategy${describeContext(context)}: ${String(value.decision_rng_strategy)}`);
  }
  assertInteger(value.step_timeout_ms, context, "step_timeout_ms", { min: 1 });
  assertString(value.modifier_policy, context, "modifier_policy");
  assertInteger(value.max_shop_purchases_per_phase, context, "max_shop_purchases_per_phase");
  // Optional: Ausgaben von vor dem Reroll-Support (Reroll damals gesperrt) haben das Feld nicht.
  if (value.max_rerolls_per_wave !== undefined) {
    assertInteger(value.max_rerolls_per_wave, context, "max_rerolls_per_wave", { min: 0 });
  }
  assertString(value.combat_dqn_checkpoint, context, "combat_dqn_checkpoint");
  assertString(value.combat_dqn_device, context, "combat_dqn_device");
  assertString(value.generated_at, context, "generated_at");
  value.episodes.forEach((episode, index) => {
    const normalizedEpisode = validateEpisode(episode, `${context}.episodes[${index}]`);
    const expectedDecisionRngSeed = `${value.seed}::${normalizedEpisode.run_index}`;
    if (normalizedEpisode.decision_rng_seed !== expectedDecisionRngSeed) {
      throw new Error(
        `Unexpected decision_rng_seed${describeContext(`${context}.episodes[${index}]`)}:`
        + ` expected ${expectedDecisionRngSeed}, got ${String(normalizedEpisode.decision_rng_seed)}`,
      );
    }
  });
  validateSummary(value.summary, `${context}.summary`);

  return structuredClone(value);
}
