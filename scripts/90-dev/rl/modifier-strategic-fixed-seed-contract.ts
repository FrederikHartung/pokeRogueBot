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

function assertBoolean(value: unknown, context: string, fieldName: string): void {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid boolean field${describeContext(context)}: ${fieldName}`);
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
      "modifier_decision",
      "selected_action",
      "selected_action_valid",
      "immediate_reward",
    ]),
    context,
    "modifier step",
  );
  assertInteger(value.step_index, context, "step_index");
  assertString(value.worker_id, context, "worker_id");
  assertString(value.decision_rng_seed, context, "decision_rng_seed");
  assertInteger(value.wave_index, context, "wave_index");
  assertArray(value.combat_turns, context, "combat_turns");
  assertPlainObject(value.modifier_decision, context, "modifier_decision");
  assertPlainObject(value.selected_action, context, "selected_action");
  assertBoolean(value.selected_action_valid, context, "selected_action_valid");
  assertNumber(value.immediate_reward, context, "immediate_reward");
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
      "combat_dqn_checkpoint",
      "combat_dqn_device",
      "generated_at",
      "episodes",
      "summary",
    ]),
    context,
    "output",
  );

  assertString(value.schema_version, context, "schema_version");
  if (value.schema_version !== "modifier_strategic_fixed_seed_output_v1") {
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
  assertString(value.combat_dqn_checkpoint, context, "combat_dqn_checkpoint");
  assertString(value.combat_dqn_device, context, "combat_dqn_device");
  assertString(value.generated_at, context, "generated_at");
  assertArray(value.episodes, context, "episodes");
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
