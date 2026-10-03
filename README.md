# GlowSnap

<p align="center">
  <img src="./packaging/io.github.libreglow.glowsnap.png" alt="GlowSnap Logo" width="128">
</p>

<p align="center">
  <b>A modern open-source screenshot and visual editing tool for Linux.</b>
  <br>
  Capture, customize, and transform your screenshots into beautiful visuals with a simple and elegant workflow.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Linux-blue">
  <img src="https://img.shields.io/badge/license-MIT-green">
  <img src="https://img.shields.io/badge/status-Stable%20-blue">
</p>

<p align="center">
  <img src="./docs/images/banner.png" alt="GlowSnap Banner">
</p>

## About

GlowSnap is an open-source Linux productivity tool designed to make screenshots more powerful and beautiful.

It helps you capture your screen, organize your screenshots, and turn them into polished visuals with modern editing tools, customizable styles, and a clean user experience.

Built with simplicity and performance in mind, GlowSnap aims to bring a premium screenshot workflow to Linux.

Turn raw code and screenshots into polished, professional assets in one click. Perfect for content creators, developers, and testers on Linux.
<p align="center">
  <img src="./docs/images/res.png" alt="GlowSnap">
</p>

## Features

### Screenshot Studio

- Full screen screenshots
- Area selection capture
- Screenshot gallery
- Full-screen image viewer

### Visual Editor

- Free drawing
- Arrows and shapes
- Text editing
- Custom colors and opacity
- Crop tools

---

## Screenshots

<p align="center">
  <img src="./docs/images/studio.png" width="800" alt="GlowSnap Studio">
</p>

<p align="center">
  <img src="./docs/images/editor.png" width="800" alt="GlowSnap Editor">
</p>

---

## Installation

### Linux

GlowSnap is currently in active development.

A Flatpak release is coming soon:

```
Coming soon on Flathub
```

---

## Testing

Run the complete validation with a single command:

```bash
./test.sh
```

That is the same entry point CI uses, so what passes locally passes on a pull
request. It orchestrates two scripts that also work standalone:

```text
./test.sh
    ├── ./scripts/test-frontend.sh   # lint, typecheck (app + tests), vitest, build
    └── ./scripts/test-backend.sh    # gofmt, go vet, go test
```

```bash
./test.sh              # everything
./test.sh frontend     # frontend only
./test.sh backend      # backend only
```

Each stage prints a banner, output is shown as-is, and the first failure stops
the run with a non-zero exit code.

### Where tests live

All test code — helpers, fixtures, mocks, setup files and configuration — lives
in the top-level [`tests/`](./tests) folder, never next to the source it covers:

```text
tests/
├── backend/                # Go tests (mirrors the package layout)
│   ├── app_test.go
│   └── services/<pkg>/*_test.go
└── frontend/               # Vitest + Testing Library suites
    ├── test-setup.ts
    ├── test-support/wails.ts
    └── components/, lib/
```

Go requires a `_test.go` file to sit in the directory of the package it covers,
so each one is a **symlink** from its package directory into `tests/backend/`.
Edit the file under `tests/backend/`, never the symlink. `tests/` is its own Go
module (`tests/go.mod`) so those sources stay out of the root module's `./...`
pattern.

### Prerequisites

Building and testing requires WebKitGTK 4.1 + GTK3 development libraries. On
Debian/Ubuntu/Fedora you can install them with:

```bash
./scripts/install-deps.sh --install
```

Frontend dependencies use **npm** (`frontend/package-lock.json` is the
authoritative lockfile):

```bash
cd frontend && npm ci
```

`./scripts/test-frontend.sh` runs `npm ci` automatically if `node_modules` is
missing.

### Backend (Go)

```bash
./scripts/test-backend.sh          # gofmt + go vet + go test

# Or run the underlying commands directly:
gofmt -l .                          # reports problems, never rewrites
go vet -tags webkit2_41 ./...
go test -count=1 -tags webkit2_41 ./...

# One package, or one test
go test -tags webkit2_41 ./services/settings -run TestSupportedResolutions
```

`third_party/` is excluded from the formatting check — it is a vendored copy of
the Wails module pulled in by the `replace` directive in `go.mod`, not project
source.

> The `webkit2_41` build tag is required because Wails needs the WebKitGTK 4.1
> API. Omitting it fails to compile.

### Frontend (TypeScript)

```bash
./scripts/test-frontend.sh         # lint + typecheck + vitest + build
```

Or, from the `frontend` directory:

```bash
npm run typecheck        # tsc --noEmit (app sources)
npm run typecheck:test   # tsc -p tsconfig.test.json (test sources)
npm test                 # vitest run
npm run test:watch       # re-run on change
npm run test:coverage    # coverage report
npm run build            # tsc + vite build
```

Test sources are type-checked by a separate project (`frontend/tsconfig.test.json`)
because `tsconfig.json` intentionally only covers `frontend/src`.

Run a single file or filter by name by passing the path or `-t` through Vitest:

```bash
cd frontend
npx vitest run ../tests/frontend/components/editor/Canvas.test.tsx
npx vitest run -t "screencast"
```

Notes:

- There is no linter configured yet. `npm run lint` is a placeholder, and
  `test-frontend.sh` skips the step with a notice until an ESLint config is added.
- Import app code with `@/…` and test helpers with `@tests/…`.
- Konva cannot render in jsdom, so `Canvas.test.tsx` mocks `react-konva`. That
  mock works because `frontend/vitest.config.ts` aliases `react-konva` to an
  absolute path — without the alias the bare specifier fails to resolve from
  `tests/frontend` and the real Konva loads.

### Continuous integration

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every pull
request and every push to `main`. It has two independent jobs that execute in
parallel and each call the very same script used locally:

| Job       | Runs                        |
| --------- | --------------------------- |
| Frontend  | `./scripts/test-frontend.sh` |
| Backend   | `./scripts/test-backend.sh`  |

Because the scripts are the single source of truth for the validation commands,
local and CI behaviour cannot drift apart.

### Running everything in Docker

If you would rather not install the native toolchain locally, the
[Dockerfile](./Dockerfile) type-checks and tests both halves inside a container —
see [Building with Docker](#building-with-docker) below.

---

## Building with Docker

GlowSnap ships a [multi-stage `Dockerfile`](./Dockerfile) that provides a fully
reproducible Linux build environment. It installs the native toolchain (Go,
Node, Wails/WebKitGTK 4.1 system libraries) inside an isolated container, builds
the frontend, runs the test suite, and compiles the final binary.

This container is **strictly for building and testing** — it does not run the
GUI and does not forward X11/Wayland, DBus, or audio.

> **Prerequisite:** the build uses BuildKit, which is enabled by default in
> modern Docker. On older Docker versions set `DOCKER_BUILDKIT=1`.

### Build the binary (and run the tests)

The tests run as part of the build. The default final stage (`artifacts`) is a
minimal image containing only the compiled binary at `/glowsnap`:

```bash
docker build -t glowsnap:build .
```

### Export only the binary

Explicitly target the `artifacts` stage and write the binary to `./out`:

```bash
docker build --target artifacts -o out/ .
./out/glowsnap --version
```

### Run the test suite inside the container

Tag the runnable `builder` stage (it contains the Go toolchain and source, and
its working directory is `/build`), then run the tests exactly as CI does:

```bash
docker build --target builder -t glowsnap:builder .
docker run --rm glowsnap:builder go test -tags webkit2_41 ./...
```

### Build with a custom version string

The injected version defaults to `dev`. Pass a release version with an `ARG`:

```bash
docker build --build-arg VERSION=1.1.0 -t glowsnap:build .
```

### Portability note

The resulting binary is a **reproducible Linux build**, but it is **not a
universally portable binary across all Linux distributions**. GlowSnap links
dynamically against GTK/WebKitGTK and other system libraries that must be
present on the target machine at runtime. For a self-contained, distribution
independent artifact, use the AppImage packaging (see `scripts/build-appimage.sh`).

---

## Built With

- **Go** — Backend and native system integration
- **Wails** — Desktop application framework
- **React + TypeScript** — User interface
- **Tailwind CSS** — Styling
- **shadcn/ui** — UI components
- **Konva** — Canvas-based editing

---

## Roadmap

### v1.1.0

- [x] Add screencast ( BETA )
- [ ] Add settings

### v1.1.1

- [ ] Add more fonts
- [ ] Add blur effect to the editor

### Future

- Screenshot
- Advanced image editor
- Productivity tools ecosystem
- More native Linux integrations

---

## Contributing

Contributions are welcome!

Whether you are a developer, designer, tester, or Linux enthusiast, you can help improve GlowSnap.

Check out our contribution guide:

```
CONTRIBUTING.md
```

---

## License

GlowSnap is licensed under the MIT License.

You are free to use, modify, and distribute this software.

---

## Vision

GlowSnap is not only a screenshot tool.

The goal is to build a collection of beautiful, simple, and open-source productivity tools designed specifically for Linux users.
