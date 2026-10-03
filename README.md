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

All test files live in the top-level [`tests/`](./tests) folder, not next to the
source they cover.

```
tests/
├── backend/                # Go tests (mirrors the package layout)
│   ├── app_test.go
│   └── services/<pkg>/*_test.go
└── frontend/               # Vitest + Testing Library suites
    ├── test-setup.ts
    ├── test-support/wails.ts
    └── components/, lib/
```

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

### Backend (Go)

Go requires test files to sit in the directory of the package they test, so each
one is a **symlink** from its package directory into `tests/backend/`. Edit the
file under `tests/backend/`, never the symlink. `tests/` is its own Go module
(`tests/go.mod`) so those sources are excluded from the root module's `./...`
pattern.

```bash
# Run every Go test
go test -tags webkit2_41 ./...

# Run one package, or one test
go test -tags webkit2_41 ./services/settings/
go test -tags webkit2_41 ./services/settings/ -run TestSupportedResolutions

# Verbose output
go test -v -tags webkit2_41 ./...
```

Static checks (CI runs both, so keep them clean):

```bash
gofmt -l .                              # must print nothing
go vet -tags webkit2_41 ./...
```

> The `webkit2_41` build tag is required because Wails needs the WebKitGTK 4.1
> API. Omitting it fails to compile.

### Frontend (TypeScript)

The Vitest config (`frontend/vitest.config.ts`) points at `tests/frontend`, so run
the commands from the `frontend` directory:

```bash
cd frontend

npm test                 # run the suite once
npm run test:watch       # re-run on change
npm run test:coverage    # coverage report
```

Run a single file or filter by name by passing the path or `-t` through Vitest:

```bash
npx vitest run ../tests/frontend/components/editor/Canvas.test.tsx
npx vitest run -t "screencast"
```

Type-check and build (this is the other frontend CI check):

```bash
npm run build            # tsc, then vite build
```

Notes:

- Import app code with `@/…` and test helpers with `@tests/…`.
- Konva cannot render in jsdom, so `Canvas.test.tsx` mocks `react-konva`. That
  mock works because `frontend/vitest.config.ts` aliases `react-konva` to an
  absolute path — without the alias the bare specifier fails to resolve from
  `tests/frontend` and the real Konva loads.

### Running everything in Docker

If you would rather not install the native toolchain locally, the
[Dockerfile](./Dockerfile) builds and runs the whole suite in a container — see
[Building with Docker](#building-with-docker) below.

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
