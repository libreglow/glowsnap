# syntax=docker/dockerfile:1

# ============================================================================
# GlowSnap — reproducible Linux build container (Wails v2 desktop app)
#
# Produces ONLY the compiled `glowsnap` binary. This container is strictly for
# building and testing. It does NOT run the GUI and does not forward X11,
# Wayland, DBus, or audio into the container.
#
# Stages:
#   frontend  (dependency, not a target)  - builds the React/TS UI into dist/
#   builder   (default target)            - runs tests + compiles the Go/Wails binary
#   artifacts (--target artifacts)        - scratch image exporting just the binary
#
# Requires BuildKit (the modern Docker default; enable via DOCKER_BUILDKIT=1
# if you are on an old Docker that does not enable it automatically).
#
# Usage:
#   docker build -t glowsnap:build .                                   # build + test
#   docker build --target artifacts -o out/ .                          # export binary
#   docker run --rm glowsnap:build go test -tags webkit2_41 ./...      # run tests
#
# NOTE: The produced binary is a REPRODUCIBLE Linux build, but it is NOT a
# universally portable binary across Linux distributions. GlowSnap links
# dynamically against GTK/WebKitGTK and other system libraries that must be
# present on the target machine at runtime.
# ============================================================================

# ---------------------------------------------------------------------------
# Stage frontend : build the embedded web assets (Node 22 / Debian Bookworm).
# ---------------------------------------------------------------------------
FROM node:22-bookworm AS frontend

WORKDIR /app

# Install dependencies first for better layer caching. The BuildKit cache mount
# on the npm cache avoids re-downloading packages across repeated builds.
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy the remaining frontend sources (including the committed Wails bindings
# under frontend/wailsjs) and produce the embedded `dist/` bundle.
COPY frontend/ ./

# The Vitest config loads suites from tests/frontend, so the test sources have to
# be present in this stage as well.
COPY tests/frontend/ ../tests/frontend/

# Type-check app + test sources, then run the suite and build the bundle.
RUN npm run typecheck && npm run typecheck:test
RUN npm test
RUN npm run build

# ---------------------------------------------------------------------------
# Stage builder : compile the Go/Wails backend and run the test suite.
# ---------------------------------------------------------------------------
FROM golang:1.25-bookworm AS builder

ARG VERSION=dev
ENV CGO_ENABLED=1

# Native libraries required to link the Wails/WebKitGTK 4.1 bindings.
# This mirrors the Debian/Ubuntu package list in scripts/install-deps.sh.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        libgtk-3-dev \
        libwebkit2gtk-4.1-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        libwayland-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy the module manifests AND the locally-replaced Wails module before
# `go mod download` so the dependency layer is cached until these change.
# third_party/ is required: go.mod uses `replace github.com/wailsapp/wails/v2
# => ./third_party/wails`, so its contents must be present for module
# resolution and compilation. The BuildKit cache mount keeps the module cache
# between builds.
COPY go.mod go.sum ./
COPY third_party/ ./third_party/
RUN --mount=type=cache,target=/go/pkg/mod go mod download

# Place the freshly built frontend bundle where the //go:embed all:frontend/dist
# directive expects it.
COPY --from=frontend /app/dist ./frontend/dist

# tests/backend/ holds the Go test sources. The *_test.go files inside the
# package directories are symlinks into it, and COPY dereferences symlinks, so
# this must be copied BEFORE the Go sources or the links would dangle.
COPY tests/backend/ ./tests/backend/
COPY scripts/ ./scripts/

# Copy the Go sources (root packages + services) and the embedded icon.
COPY *.go ./
COPY services/ ./services/
COPY build/appicon.png ./build/appicon.png

# Run the same backend checks as CI and ./test.sh (gofmt, go vet, go test).
RUN ./scripts/test-backend.sh

# Compile the production binary with the pinned version injection.
RUN go build -tags webkit2_41 -trimpath \
        -ldflags "-X main.appVersion=$VERSION" \
        -o build/bin/glowsnap .

# ---------------------------------------------------------------------------
# Stage artifacts : export ONLY the compiled binary, for --target artifacts.
# ---------------------------------------------------------------------------
FROM scratch AS artifacts
COPY --from=builder /build/build/bin/glowsnap /glowsnap