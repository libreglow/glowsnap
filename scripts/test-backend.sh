#!/usr/bin/env bash
#
# test-backend.sh - Validate the Go/Wails backend.
#
# Runs, in order:
#   1. gofmt validation (read-only; never rewrites files)
#   2. go vet
#   3. go test (uncached, so results are always real)
#
# Test sources live in tests/backend/. Go requires a _test.go file to sit next to
# the package it covers, so each one is a symlink from its package directory into
# tests/backend/. tests/ is its own Go module, which keeps those sources out of
# the root module's ./... pattern while the symlinks still compile them into
# their real packages.
#
# Usage:
#   ./scripts/test-backend.sh
#
# Environment:
#   GO_TEST_FLAGS  Extra flags passed to 'go test' (default: none).
#   BUILD_TAGS     Build tags to use (default: webkit2_41, required by Wails).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

BUILD_TAGS="${BUILD_TAGS:-webkit2_41}"
GO_TEST_FLAGS="${GO_TEST_FLAGS:-}"

# third_party/ is a vendored copy of the Wails module pulled in by the
# `replace` directive in go.mod. It is not project source, so it is excluded
# from our own formatting rules.
EXCLUDE_DIR='^\./third_party(/|$)'

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

command -v go >/dev/null 2>&1 || fail "go not found in PATH. Install Go 1.25+."

if [ ! -d "tests/backend" ]; then
    fail "tests/backend not found - test sources are missing."
fi

# Fail early (and loudly) if a symlink lost its target, which otherwise shows up
# as a confusing "no test files" result instead of a real test run.
BROKEN_LINKS="$(find app_test.go services tests -name '*_test.go' -type l ! -exec test -e {} \; -print 2>/dev/null || true)"
if [ -n "$BROKEN_LINKS" ]; then
    echo "ERROR: broken test symlinks (target missing):" >&2
    echo "$BROKEN_LINKS" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
section "Backend: gofmt"
# ---------------------------------------------------------------------------
# 'gofmt -l' only lists files; it never modifies them.
UNFORMATTED="$(gofmt -l . | grep -Ev "$EXCLUDE_DIR" || true)"

if [ -n "$UNFORMATTED" ]; then
    echo "The following files are not gofmt-formatted:" >&2
    echo "$UNFORMATTED" >&2
    echo >&2
    echo "Fix them with: gofmt -w <file>" >&2
    exit 1
fi
echo "All Go files are gofmt-formatted."

# ---------------------------------------------------------------------------
section "Backend: go vet"
# ---------------------------------------------------------------------------
go vet -tags "$BUILD_TAGS" ./...

# ---------------------------------------------------------------------------
section "Backend: go test"
# ---------------------------------------------------------------------------
# -count=1 disables the test cache so results always reflect the current tree.
go test -count=1 -tags "$BUILD_TAGS" $GO_TEST_FLAGS ./...

echo
echo "Backend checks passed."
