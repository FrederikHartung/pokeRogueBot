function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeContext(context) {
  return context ? ` for ${context}` : "";
}

function assertAllowedKeys(value, allowedKeys, context) {
  const unknownKeys = Object.keys(value).filter(key => !allowedKeys.has(key));
  if (unknownKeys.length === 0) {
    return;
  }
  throw new Error(
    `Unsupported policy field(s)${describeContext(context)}: ${unknownKeys.join(", ")}`,
  );
}

function assertFiniteNumber(value, context, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric policy field${describeContext(context)}: ${fieldName}`);
  }
}

function assertStringArray(value, context, fieldName) {
  if (!Array.isArray(value) || value.length === 0 || value.some(entry => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`Invalid string-array policy field${describeContext(context)}: ${fieldName}`);
  }
}

function assertStringRecord(value, context, fieldName) {
  if (!isPlainObject(value) || Object.values(value).some(entry => typeof entry !== "string")) {
    throw new Error(`Invalid string-record policy field${describeContext(context)}: ${fieldName}`);
  }
}

function assertNoLegacyEpsilonKeys(policyConfig, context) {
  const legacyKeys = ["epsilon_start", "epsilon_end"].filter(key => key in policyConfig);
  if (legacyKeys.length === 0) {
    return;
  }
  throw new Error(
    `Legacy epsilon field(s)${describeContext(context)} are not supported: ${legacyKeys.join(", ")}.`
    + " Use start_epsilon/end_epsilon instead.",
  );
}

function validateExternalCommandPolicy(policyConfig, context) {
  assertAllowedKeys(
    policyConfig,
    new Set(["type", "command", "env", "timeout_ms", "persistent", "step_timeout_ms"]),
    context,
  );

  if ("command" in policyConfig) {
    assertStringArray(policyConfig.command, context, "command");
  }
  if ("env" in policyConfig) {
    assertStringRecord(policyConfig.env, context, "env");
  }
  if ("timeout_ms" in policyConfig) {
    assertFiniteNumber(policyConfig.timeout_ms, context, "timeout_ms");
  }
  if ("step_timeout_ms" in policyConfig) {
    assertFiniteNumber(policyConfig.step_timeout_ms, context, "step_timeout_ms");
  }
  if ("persistent" in policyConfig && typeof policyConfig.persistent !== "boolean") {
    throw new Error(`Invalid boolean policy field${describeContext(context)}: persistent`);
  }

  return structuredClone(policyConfig);
}

function validateSimplePolicy(policyConfig, context) {
  assertAllowedKeys(policyConfig, new Set(["type"]), context);
  return structuredClone(policyConfig);
}

function validateEpsilonRandomPolicy(policyConfig, context) {
  assertNoLegacyEpsilonKeys(policyConfig, context);
  assertAllowedKeys(
    policyConfig,
    new Set([
      "type",
      "start_epsilon",
      "end_epsilon",
      "decay_fraction",
      "decay_episodes",
      "epsilon",
      "epsilon_by_iteration",
      "exploit_policy",
    ]),
    context,
  );

  for (const numericField of ["start_epsilon", "end_epsilon", "decay_fraction", "decay_episodes", "epsilon"]) {
    if (numericField in policyConfig) {
      assertFiniteNumber(policyConfig[numericField], context, numericField);
    }
  }

  if ("epsilon_by_iteration" in policyConfig) {
    const { epsilon_by_iteration: epsilonByIteration } = policyConfig;
    const isValidArray = Array.isArray(epsilonByIteration) && epsilonByIteration.every(value => typeof value === "number" && Number.isFinite(value));
    const isValidObject = isPlainObject(epsilonByIteration)
      && Object.values(epsilonByIteration).every(value => typeof value === "number" && Number.isFinite(value));
    if (!isValidArray && !isValidObject) {
      throw new Error(`Invalid policy field${describeContext(context)}: epsilon_by_iteration`);
    }
  }

  const normalized = structuredClone(policyConfig);
  if ("exploit_policy" in normalized) {
    normalized.exploit_policy = validatePolicyConfig(normalized.exploit_policy, {
      context: context ? `${context}.exploit_policy` : "exploit_policy",
      allowTypes: ["random", "first_valid", "external_command"],
    });
  }

  return normalized;
}

export function validatePolicyConfig(policyConfig, options = {}) {
  const { context = "policy", allowTypes = null } = options;
  if (!isPlainObject(policyConfig)) {
    throw new Error(`Policy config${describeContext(context)} must be an object`);
  }

  const type = typeof policyConfig.type === "string" && policyConfig.type.length > 0
    ? policyConfig.type
    : null;
  if (!type) {
    throw new Error(`Policy config${describeContext(context)} requires a non-empty string type`);
  }

  if (Array.isArray(allowTypes) && !allowTypes.includes(type)) {
    throw new Error(
      `Unsupported policy type${describeContext(context)}: ${type}. Allowed: ${allowTypes.join(", ")}`,
    );
  }

  switch (type) {
    case "random":
    case "first_valid":
      return validateSimplePolicy(policyConfig, context);
    case "external_command":
      return validateExternalCommandPolicy(policyConfig, context);
    case "epsilon_random":
      return validateEpsilonRandomPolicy(policyConfig, context);
    default:
      throw new Error(`Unsupported policy type${describeContext(context)}: ${type}`);
  }
}
