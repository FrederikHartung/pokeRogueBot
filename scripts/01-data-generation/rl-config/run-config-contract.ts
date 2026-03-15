import { validatePolicyConfig } from "./policy-contract.ts";

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeContext(context) {
  return context ? ` for ${context}` : "";
}

function assertPlainObject(value, context, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label}${describeContext(context)} must be an object`);
  }
}

function assertAllowedKeys(value, allowedKeys, context, label) {
  const unknownKeys = Object.keys(value).filter(key => !allowedKeys.has(key));
  if (unknownKeys.length === 0) {
    return;
  }
  throw new Error(`Unsupported ${label} field(s)${describeContext(context)}: ${unknownKeys.join(", ")}`);
}

function assertOptionalString(value, context, fieldName) {
  if (value != null && (typeof value !== "string" || value.length === 0)) {
    throw new Error(`Invalid string field${describeContext(context)}: ${fieldName}`);
  }
}

function assertOptionalBoolean(value, context, fieldName) {
  if (value != null && typeof value !== "boolean") {
    throw new Error(`Invalid boolean field${describeContext(context)}: ${fieldName}`);
  }
}

function assertPositiveInteger(value, context, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid positive integer field${describeContext(context)}: ${fieldName}`);
  }
}

function assertNonNegativeInteger(value, context, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid non-negative integer field${describeContext(context)}: ${fieldName}`);
  }
}

function assertOptionalInteger(value, context, fieldName, { positive = false } = {}) {
  if (value == null) {
    return;
  }
  if (positive) {
    assertPositiveInteger(value, context, fieldName);
    return;
  }
  assertNonNegativeInteger(value, context, fieldName);
}

function assertFiniteNumber(value, context, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric field${describeContext(context)}: ${fieldName}`);
  }
}

function assertOptionalStringArray(value, context, fieldName, { allowEmpty = false } = {}) {
  if (value == null) {
    return;
  }
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some(entry => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`Invalid string-array field${describeContext(context)}: ${fieldName}`);
  }
}

function assertOptionalIntegerArray(value, context, fieldName) {
  if (value == null) {
    return;
  }
  if (!Array.isArray(value) || value.some(entry => !Number.isInteger(entry))) {
    throw new Error(`Invalid integer-array field${describeContext(context)}: ${fieldName}`);
  }
}

function validateCollectorOverrides(value, context) {
  assertPlainObject(value, context, "collector overrides");
  assertAllowedKeys(
    value,
    new Set([
      "append_output",
      "episode_index_offset",
      "enemy_team_overrides_path",
      "max_steps_per_episode",
      "output_path",
      "player_team_overrides_path",
      "progress_pause_enabled",
      "progress_pause_ms",
      "progress_pause_percent_step",
      "progress_pause_target_transitions",
      "quiet_game_logs",
      "reward_alive_team_member_win_bonus",
      "reward_consecutive_switch_penalty",
      "reward_consecutive_switch_penalty_scale",
      "reward_direct_backswitch_penalty",
      "reward_enemy_faint_bonus",
      "reward_enemy_team_defeat_bonus",
      "reward_enemy_team_hp_damage_scale",
      "reward_player_faint_penalty",
      "reward_player_team_defeat_penalty",
      "reward_player_team_hp_loss_scale",
      "reward_remaining_team_hp_ratio_win_bonus_scale",
      "reward_step_penalty",
      "reward_switch_penalty",
      "state_variants",
      "terminal_on_egg_lapse",
      "test_timeout_ms",
    ]),
    context,
    "collector override",
  );

  for (const key of [
    "episode_index_offset",
    "max_steps_per_episode",
    "progress_pause_ms",
    "progress_pause_percent_step",
    "progress_pause_target_transitions",
    "test_timeout_ms",
  ]) {
    if (key in value) {
      assertOptionalInteger(value[key], context, key, { positive: key !== "episode_index_offset" });
    }
  }

  for (const key of [
    "reward_alive_team_member_win_bonus",
    "reward_consecutive_switch_penalty",
    "reward_consecutive_switch_penalty_scale",
    "reward_direct_backswitch_penalty",
    "reward_enemy_faint_bonus",
    "reward_enemy_team_defeat_bonus",
    "reward_enemy_team_hp_damage_scale",
    "reward_player_faint_penalty",
    "reward_player_team_defeat_penalty",
    "reward_player_team_hp_loss_scale",
    "reward_remaining_team_hp_ratio_win_bonus_scale",
    "reward_step_penalty",
    "reward_switch_penalty",
  ]) {
    if (key in value) {
      assertFiniteNumber(value[key], context, key);
    }
  }

  for (const key of ["append_output", "progress_pause_enabled", "quiet_game_logs", "terminal_on_egg_lapse"]) {
    if (key in value) {
      assertOptionalBoolean(value[key], context, key);
    }
  }

  for (const key of ["enemy_team_overrides_path", "output_path", "player_team_overrides_path"]) {
    if (key in value) {
      assertOptionalString(value[key], context, key);
    }
  }

  if ("state_variants" in value) {
    assertOptionalStringArray(value.state_variants, context, "state_variants");
  }

  return structuredClone(value);
}

function validateRandomCollectionCollectConfig(value, context) {
  assertPlainObject(value, context, "collect config");
  assertAllowedKeys(value, new Set(["episodes_per_instance", "batch_size", "parallelism", "collector", "policy"]), context, "collect config");
  assertPositiveInteger(value.episodes_per_instance, context, "episodes_per_instance");
  assertPositiveInteger(value.batch_size, context, "batch_size");
  if ("parallelism" in value) {
    assertPositiveInteger(value.parallelism, context, "parallelism");
  }

  const normalized = structuredClone(value);
  normalized.collector = validateCollectorOverrides(value.collector ?? {}, `${context}.collector`);
  normalized.policy = validatePolicyConfig(value.policy ?? { type: "random" }, {
    context: `${context}.policy`,
    allowTypes: ["random"],
  });
  return normalized;
}

function validateArchiveConfig(value, context) {
  assertPlainObject(value, context, "archive config");
  assertAllowedKeys(value, new Set(["format", "output_path"]), context, "archive config");
  if ("format" in value && !["tar.gz", "zip"].includes(value.format)) {
    throw new Error(`Unsupported archive format${describeContext(context)}: ${value.format}`);
  }
  if ("output_path" in value) {
    assertOptionalString(value.output_path, context, "output_path");
  }
  return structuredClone(value);
}

function validateDatasetPoolConfig(value, context) {
  assertPlainObject(value, context, "dataset pool config");
  assertAllowedKeys(value, new Set(["root_dir", "combat_version", "usecase", "run_name"]), context, "dataset pool config");
  if ("root_dir" in value) {
    assertOptionalString(value.root_dir, context, "root_dir");
  }
  assertOptionalString(value.combat_version, context, "combat_version");
  assertOptionalString(value.usecase, context, "usecase");
  if ("run_name" in value) {
    assertOptionalString(value.run_name, context, "run_name");
  }
  if (typeof value.combat_version !== "string" || value.combat_version.length === 0) {
    throw new Error(`Missing required dataset pool field${describeContext(context)}: combat_version`);
  }
  if (typeof value.usecase !== "string" || value.usecase.length === 0) {
    throw new Error(`Missing required dataset pool field${describeContext(context)}: usecase`);
  }
  return structuredClone(value);
}

function validateRuntimeRetentionConfig(value, context) {
  assertPlainObject(value, context, "runtime retention config");
  assertAllowedKeys(
    value,
    new Set(["archive_debug_on_success", "cleanup_runtime_on_success", "include_batch_configs_in_debug_archive", "include_batch_outputs_in_debug_archive"]),
    context,
    "runtime retention config",
  );
  for (const key of [
    "archive_debug_on_success",
    "cleanup_runtime_on_success",
    "include_batch_configs_in_debug_archive",
    "include_batch_outputs_in_debug_archive",
  ]) {
    if (key in value) {
      assertOptionalBoolean(value[key], context, key);
    }
  }
  return structuredClone(value);
}

function validateIterativeCollectPhase(value, context, allowRandomPolicy) {
  assertPlainObject(value, context, "iterative collect phase");
  assertAllowedKeys(value, new Set(["episodes_per_instance", "batch_size", "parallelism", "enabled", "collector", "policy", "device"]), context, "iterative collect phase");
  assertPositiveInteger(value.episodes_per_instance, context, "episodes_per_instance");
  assertPositiveInteger(value.batch_size, context, "batch_size");
  if ("parallelism" in value) {
    assertPositiveInteger(value.parallelism, context, "parallelism");
  }
  if ("enabled" in value) {
    assertOptionalBoolean(value.enabled, context, "enabled");
  }
  if ("device" in value) {
    assertOptionalString(value.device, context, "device");
  }

  const normalized = structuredClone(value);
  normalized.collector = validateCollectorOverrides(value.collector ?? {}, `${context}.collector`);
  normalized.policy = validatePolicyConfig(value.policy ?? { type: allowRandomPolicy ? "random" : "epsilon_random" }, {
    context: `${context}.policy`,
    allowTypes: allowRandomPolicy ? ["random", "first_valid", "external_command"] : ["epsilon_random"],
  });
  return normalized;
}

function validateTrainingConfig(value, context, isIteration) {
  assertPlainObject(value, context, "train config");
  assertAllowedKeys(value, new Set(isIteration ? ["template_config_path", "output_path_pattern"] : ["template_config_path", "output_path"]), context, "train config");
  assertOptionalString(value.template_config_path, context, "template_config_path");
  if (isIteration) {
    assertOptionalString(value.output_path_pattern, context, "output_path_pattern");
  } else {
    assertOptionalString(value.output_path, context, "output_path");
  }
  return structuredClone(value);
}

function validateBenchmarkConfig(value, context, isIteration) {
  assertPlainObject(value, context, "benchmark config");
  assertAllowedKeys(
    value,
    new Set(
      isIteration
        ? ["collector_config_path", "report_path_pattern", "dqn_output_path_pattern", "dqn_report_path_pattern", "reuse_baseline_policies", "max_steps_per_episode", "parallelism"]
        : ["collector_config_path", "report_path", "max_steps_per_episode", "parallelism"],
    ),
    context,
    "benchmark config",
  );
  for (const key of ["collector_config_path", isIteration ? "report_path_pattern" : "report_path", "dqn_output_path_pattern", "dqn_report_path_pattern"]) {
    if (key in value) {
      assertOptionalString(value[key], context, key);
    }
  }
  if ("max_steps_per_episode" in value) {
    assertPositiveInteger(value.max_steps_per_episode, context, "max_steps_per_episode");
  }
  if ("parallelism" in value) {
    assertPositiveInteger(value.parallelism, context, "parallelism");
  }
  if ("reuse_baseline_policies" in value) {
    assertOptionalBoolean(value.reuse_baseline_policies, context, "reuse_baseline_policies");
  }
  return structuredClone(value);
}

export function validateCollectorRunConfig(value, options = {}) {
  const { context = "collector config" } = options;
  assertPlainObject(value, context, "collector config");
  assertAllowedKeys(
    value,
    new Set([
      "scenario_dir",
      "scenario_dirs",
      "scenario_files",
      "output_path",
      "append_output",
      "episodes_per_seed",
      "episode_index_offset",
      "max_steps_per_episode",
      "test_timeout_ms",
      "quiet_game_logs",
      "policy",
      "seeds",
      "state_variants",
      "terminal_on_egg_lapse",
      "progress_pause_enabled",
      "progress_pause_ms",
      "progress_pause_percent_step",
      "progress_pause_target_transitions",
      "reward_alive_team_member_win_bonus",
      "reward_consecutive_switch_penalty",
      "reward_consecutive_switch_penalty_scale",
      "reward_direct_backswitch_penalty",
      "reward_enemy_faint_bonus",
      "reward_enemy_team_defeat_bonus",
      "reward_enemy_team_hp_damage_scale",
      "reward_player_faint_penalty",
      "reward_player_team_defeat_penalty",
      "reward_player_team_hp_loss_scale",
      "reward_remaining_team_hp_ratio_win_bonus_scale",
      "reward_step_penalty",
      "reward_switch_penalty",
    ]),
    context,
    "collector config",
  );

  assertOptionalString(value.scenario_dir, context, "scenario_dir");
  assertOptionalStringArray(value.scenario_dirs, context, "scenario_dirs");
  assertOptionalStringArray(value.scenario_files, context, "scenario_files");
  assertOptionalString(value.output_path, context, "output_path");
  if ("append_output" in value) {
    assertOptionalBoolean(value.append_output, context, "append_output");
  }
  for (const key of ["episodes_per_seed", "max_steps_per_episode", "test_timeout_ms", "progress_pause_ms", "progress_pause_percent_step", "progress_pause_target_transitions"]) {
    if (key in value) {
      assertOptionalInteger(value[key], context, key, { positive: true });
    }
  }
  if ("episode_index_offset" in value) {
    assertOptionalInteger(value.episode_index_offset, context, "episode_index_offset");
  }
  for (const key of ["quiet_game_logs", "terminal_on_egg_lapse", "progress_pause_enabled"]) {
    if (key in value) {
      assertOptionalBoolean(value[key], context, key);
    }
  }
  if ("seeds" in value) {
    assertOptionalStringArray(value.seeds, context, "seeds");
  }
  if ("state_variants" in value) {
    assertOptionalStringArray(value.state_variants, context, "state_variants");
  }
  for (const key of [
    "reward_alive_team_member_win_bonus",
    "reward_consecutive_switch_penalty",
    "reward_consecutive_switch_penalty_scale",
    "reward_direct_backswitch_penalty",
    "reward_enemy_faint_bonus",
    "reward_enemy_team_defeat_bonus",
    "reward_enemy_team_hp_damage_scale",
    "reward_player_faint_penalty",
    "reward_player_team_defeat_penalty",
    "reward_player_team_hp_loss_scale",
    "reward_remaining_team_hp_ratio_win_bonus_scale",
    "reward_step_penalty",
    "reward_switch_penalty",
  ]) {
    if (key in value) {
      assertFiniteNumber(value[key], context, key);
    }
  }

  const normalized = structuredClone(value);
  normalized.policy = validatePolicyConfig(value.policy ?? { type: "random" }, {
    context: `${context}.policy`,
  });
  return normalized;
}

export function validateRandomCollectionPipelineConfig(value, options = {}) {
  const { context = "random-collection config" } = options;
  assertPlainObject(value, context, "random-collection config");
  assertAllowedKeys(
    value,
    new Set(["scenario_dirs", "scenario_files", "include_waves", "exclude_waves", "output_root", "manifest_path", "collector_defaults", "collect", "archive", "parallelism", "dataset_pool", "runtime_retention"]),
    context,
    "random-collection config",
  );

  assertOptionalStringArray(value.scenario_dirs, context, "scenario_dirs");
  assertOptionalStringArray(value.scenario_files, context, "scenario_files");
  assertOptionalIntegerArray(value.include_waves, context, "include_waves");
  assertOptionalIntegerArray(value.exclude_waves, context, "exclude_waves");
  assertOptionalString(value.output_root, context, "output_root");
  assertOptionalString(value.manifest_path, context, "manifest_path");
  if ("parallelism" in value) {
    assertPositiveInteger(value.parallelism, context, "parallelism");
  }

  const normalized = structuredClone(value);
  normalized.collector_defaults = validateCollectorOverrides(value.collector_defaults ?? {}, `${context}.collector_defaults`);
  normalized.collect = validateRandomCollectionCollectConfig(value.collect ?? {}, `${context}.collect`);
  normalized.archive = validateArchiveConfig(value.archive ?? {}, `${context}.archive`);
  if ("dataset_pool" in value) {
    normalized.dataset_pool = validateDatasetPoolConfig(value.dataset_pool, `${context}.dataset_pool`);
  }
  if ("runtime_retention" in value) {
    normalized.runtime_retention = validateRuntimeRetentionConfig(value.runtime_retention, `${context}.runtime_retention`);
  }
  return normalized;
}

export function validateIterativePipelineConfig(value, options = {}) {
  const { context = "iterative pipeline config" } = options;
  assertPlainObject(value, context, "iterative pipeline config");
  assertAllowedKeys(
    value,
    new Set([
      "scenario_dirs",
      "scenario_files",
      "include_waves",
      "exclude_waves",
      "iterations",
      "collect_parallelism",
      "benchmark_parallelism",
      "output_root",
      "manifest_path",
      "collector_defaults",
      "baseline_collect",
      "iterative_collect",
      "train_baseline",
      "train_iteration",
      "benchmark_baseline",
      "benchmark_iteration",
      "device",
    ]),
    context,
    "iterative pipeline config",
  );

  assertOptionalStringArray(value.scenario_dirs, context, "scenario_dirs");
  assertOptionalStringArray(value.scenario_files, context, "scenario_files");
  assertOptionalIntegerArray(value.include_waves, context, "include_waves");
  assertOptionalIntegerArray(value.exclude_waves, context, "exclude_waves");
  assertPositiveInteger(value.iterations, context, "iterations");
  if ("collect_parallelism" in value) {
    assertPositiveInteger(value.collect_parallelism, context, "collect_parallelism");
  }
  if ("benchmark_parallelism" in value) {
    assertPositiveInteger(value.benchmark_parallelism, context, "benchmark_parallelism");
  }
  assertOptionalString(value.output_root, context, "output_root");
  assertOptionalString(value.manifest_path, context, "manifest_path");
  if ("device" in value) {
    assertOptionalString(value.device, context, "device");
  }

  const normalized = structuredClone(value);
  normalized.collector_defaults = validateCollectorOverrides(value.collector_defaults ?? {}, `${context}.collector_defaults`);
  normalized.baseline_collect = validateIterativeCollectPhase(value.baseline_collect ?? {}, `${context}.baseline_collect`, true);
  normalized.iterative_collect = validateIterativeCollectPhase(value.iterative_collect ?? {}, `${context}.iterative_collect`, false);
  normalized.train_baseline = validateTrainingConfig(value.train_baseline ?? {}, `${context}.train_baseline`, false);
  normalized.train_iteration = validateTrainingConfig(value.train_iteration ?? {}, `${context}.train_iteration`, true);
  normalized.benchmark_baseline = validateBenchmarkConfig(value.benchmark_baseline ?? {}, `${context}.benchmark_baseline`, false);
  normalized.benchmark_iteration = validateBenchmarkConfig(value.benchmark_iteration ?? {}, `${context}.benchmark_iteration`, true);
  return normalized;
}
