# GlowSnap Documentation

```text
docs/
├── images/       # screenshots used by the README and the guides
├── user/         # end-user documentation
└── developer/    # documentation for contributors and maintainers
```

---

## User documentation

Start here if you want to **use** GlowSnap.

| Guide | What it covers |
| ----- | -------------- |
| [GlowSnap](./user/README.md) | Overview, philosophy, use cases and the vision |
| [Getting started](./user/getting-started.md) | Installation, the palette and your first capture |
| [Features](./user/features.md) | Screenshot Studio, Visual Editor, Gallery and Recording |
| [Screenshot Studio](./user/studio.md) | Browsing, searching, favouriting and organising captures |
| [Visual Editor](./user/editor.md) | Annotation tools, text, crop, background and export |
| [Screen recording](./user/recording.md) | Audio sources, resolution, pause/stop and playback |
| [Settings reference](./user/settings.md) | Every option in the Preferences panel |
| [Keyboard shortcuts](./user/shortcuts.md) | The default bindings and how to rebind them |
| [Troubleshooting](./user/troubleshooting.md) | Portal errors, audio, clipboard and Wayland |
| [Roadmap](./user/roadmap.md) | What is planned for 1.0 and beyond |
| [Open source & license](./user/open-source.md) | Contributing, privacy and the MIT license |

---

## Developer documentation

Start here if you want to **build, extend or contribute to** GlowSnap.

| Guide | What it covers |
| ----- | -------------- |
| [Overview](./developer/README.md) | The stack, the quick reference and the map of the guides |
| [Architecture](./developer/architecture.md) | The layers, the data flow, window modes and events |
| [Repository layout](./developer/repository-layout.md) | Every important file and what it does |
| [Getting started](./developer/getting-started.md) | Toolchain, dependencies and the development loop |
| [Backend](./developer/backend.md) | `app.go`, the services, D-Bus, GStreamer and settings |
| [Frontend](./developer/frontend.md) | The React app, the shortcut registry and the Konva editor |
| [Testing](./developer/testing.md) | The `tests/` tree, the runner scripts and how to add tests |
| [Building & releasing](./developer/building.md) | Binaries, AppImage, Flatpak, Docker and the release pipeline |
| [Linux integration](./developer/linux-integration.md) | Portals, Wayland/X11, clipboard, audio and notifications |
| [Contributing](./developer/contributing.md) | Workflow, commit style and the code guidelines |

The project-wide rules that every contributor must follow also live in
[`AGENTS.md`](../AGENTS.md) at the repository root, and the short contribution
guide in [`CONTRIBUTING.md`](../CONTRIBUTING.md).
