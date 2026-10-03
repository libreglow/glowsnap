#!/usr/bin/env bash
#
# test-frontend.sh - Validate the React/TypeScript frontend.
#
# Runs, in order:
#   1. Lint (skipped with a notice when no linter is configured)
#   2. Type-check application sources      (tsconfig.json)
#   3. Type-check test sources             (tsconfig.test.json)
#   4. Vitest suite
#   5. Production build
#
# Test sources live in tests/frontend/; frontend/vitest.config.ts points the
# runner at that folder. Type-checking the tests is a separate project because
# tsconfig.json intentionally only covers frontend/src.
#
# Usage:
#   ./scripts/test-frontend.sh
#
# Environment:
#   SKIP_BUILD=1   Skip the production build step.
#   SKIP_LINT=1   Skip the lint step.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR/frontend"

section() {
    echo
    echo "========================================"
    echo "$1"
    echo "========================================"
}

fail() {
    echo "ERROR: $1" >&2
    exit 1
}

command -v node >/dev/null 2>&1 || fail "node not found in PATH. Install Node.js 22+."
command -v npm  >/dev/null 2>&1 || fail "npm not found in PATH."

if [ ! -d node_modules ]; then
    echo "frontend/node_modules is missing - installing dependencies..."
    npm ci
fi

if [ ! -d "$ROOT_DIR/tests/frontend" ]; then
    fail "tests/frontend not found - test sources are missing."
fi

# ---------------------------------------------------------------------------
section "Frontend: Lint"
# ---------------------------------------------------------------------------
if [ "${SKIP_LINT:-0}" = "1" ]; then
    echo "SKIPPED (SKIP_LINT=1)."
elif [ -f eslint.config.js ] || [ -f eslint.config.mjs ] || [ -f .eslintrc.json ] ||
     [ -f .eslintrc.js ] || [ -f .eslintrc.cjs ]; then
    npm run lint
else
    echo "No ESLint configuration found - skipping lint."
    echo "(The npm \"lint\" script is a placeholder until one is added.)"
fi

# ---------------------------------------------------------------------------
section "Frontend: Type check (app sources)"
# ---------------------------------------------------------------------------
npm run typecheck

# ---------------------------------------------------------------------------
section "Frontend: Type check (test sources)"
# ---------------------------------------------------------------------------
npm run typecheck:test

# ---------------------------------------------------------------------------
section "Frontend: Tests"
# ---------------------------------------------------------------------------
npm test

# ---------------------------------------------------------------------------
section "Frontend: Build"
# ---------------------------------------------------------------------------
if [ "${SKIP_BUILD:-0}" = "1" ]; then
    echo "SKIPPED (SKIP_BUILD=1)."
else
    npm run build
fi

echo
echo "Frontend checks passed."
