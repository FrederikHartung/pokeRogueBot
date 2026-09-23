#!/usr/bin/env bash
# Type-checks scripts/**/*.ts against the root tsconfig.json's #alias/* path
# mapping and fails only on genuine import-resolution errors (missing
# module, missing named export). Everything else tsc reports - unresolved
# __PLACEHOLDER__ tokens in *.template.ts files, loose `any` typing, etc. -
# is expected noise from these being templates rather than standalone
# modules, and is ignored on purpose.
#
# Why this exists: vitest does not type-check test files before running
# them, so a wrong #alias/* import (e.g. after the pokerogue submodule
# moves/renames a file) silently resolves to `undefined` instead of failing
# fast - see docs/pokerogue-headless-test-harness-mechanics.md for a real
# incident this caused (PartyUiMode imported from a stale path).
set -euo pipefail
cd "$(dirname "$0")/../.."

IMPORT_ERROR_CODES="TS2307|TS2305|TS2459|TS2724|TS2306"

OUTPUT=$(npx tsc --noEmit -p tsconfig.json 2>&1 || true)
IMPORT_ERRORS=$(echo "$OUTPUT" | grep -E "$IMPORT_ERROR_CODES" | grep "^scripts/" || true)

if [ -n "$IMPORT_ERRORS" ]; then
  echo "Import-resolution errors found in scripts/ (would silently become 'undefined' or crash at runtime instead of failing fast):"
  echo "$IMPORT_ERRORS"
  exit 1
fi

echo "No import-resolution errors found in scripts/."
