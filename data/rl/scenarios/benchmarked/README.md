# Benchmarked Scenarios

This directory contains a small, stable scenario set for deterministic regression checks.

Policy:

- Keep this set small and curated.
- Generated bulk scenarios (`data/rl/scenarios/generated-*`) are not versioned.
- Recreate large scenario sets via generator configs and seeds.

Layout:

- `wild/` curated wild battle scenarios
- `trainer/` curated trainer battle scenarios

How to use:

- Collector can consume these files directly via `scenario_files` in a run config.
- Use this set for repeatable A/B evaluations across model versions.
