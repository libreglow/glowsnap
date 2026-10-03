#!/usr/bin/env bash
#
# test.sh - Run the complete GlowSnap validation suite.
#
# Single entry point for local development and the same commands CI runs:
#
#   ./test.sh
#     ├── ./scripts/test-frontend.sh   (lint, typecheck app+tests, vitest, build)
#     └── ./scripts/test-backend.sh    (gofmt, go vet, go test)
#
# The scripts are the source of truth for the actual commands, so local and CI
# behaviour cannot drift apart.
#
# Usage:
#   ./test.sh              # everything
#   ./test.sh frontend     # frontend only
#   ./test.sh backend      # backend only
#
# Environment:
#   SKIP_BUILD=1   Skip the frontend production build.
#   SKIP_LINT=1   Skip the frontend lint step.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
cd "$ROOT_DIR"

TARGET="${1:-all}"
START_TIME=$(date +%s)

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

run_stage() {
    local title="$1"
    shift
    section "$title"
    if "$@"; then
        return 0
    fi
    echo >&2
    echo "========================================" >&2
    echo "FAILED: $title" >&2
    echo "========================================" >&2
    exit 1
}

[ -x "$ROOT_DIR/scripts/test-frontend.sh" ] || fail "scripts/test-frontend.sh is missing or not executable."
[ -x "$ROOT_DIR/scripts/test-backend.sh" ]  || fail "scripts/test-backend.sh is missing or not executable."

case "$TARGET" in
    all)
        run_stage "Frontend Checks" "$ROOT_DIR/scripts/test-frontend.sh"
        run_stage "Backend Checks"  "$ROOT_DIR/scripts/test-backend.sh"
        ;;
    frontend)
        run_stage "Frontend Checks" "$ROOT_DIR/scripts/test-frontend.sh"
        ;;
    backend)
        run_stage "Backend Checks" "$ROOT_DIR/scripts/test-backend.sh"
        ;;
    *)
        fail "Unknown target '$TARGET'. Use: all | frontend | backend."
        ;;
esac

ELAPSED=$(( $(date +%s) - START_TIME ))

section "All checks passed (${ELAPSED}s)"
