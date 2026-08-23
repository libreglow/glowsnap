---
name: glowsnap-editor
description: The Konva/react-konva screenshot editor in GlowSnap, including the ShapeConfig model, drawing and cropping hooks, selection/transformation, viewport coordinates, and the undo/redo history mechanism. Use when modifying editor components, canvas behavior, shape handling, or history.
---

# GlowSnap Editor

## Purpose

Document how GlowSnap's in-app screenshot editor works so changes to canvas
behavior, shapes, selection, cropping, or undo/redo preserve the existing
architecture and never introduce a second source of truth.

## When to use

- Editing anything under `frontend/src/components/editor/`.
- Changing drawing, text, shape, selection, transform, crop, or history logic.
- Working with `src/lib/hooks/use*` editor hooks or `src/lib/viewport.ts`.
- Modifying the `ShapeConfig` type in `src/types/types.ts`.

## Architecture / Context

The editor is a Konva `Stage` rendered with react-konva in
`frontend/src/components/editor/Canvas.tsx`. Shapes are plain data objects of
type `ShapeConfig` (see `src/types/types.ts`): `id`, `type`
(`rect|circle|arrow|text|number|line`), position/size (`x`, `y`, `width`,
`height`, `points`), stroke/fill/opacity, and text/font props. There is no
global store — all editor state lives in React hooks composed in `Editor.tsx`.

### State and hooks (all under `src/lib/hooks/`)

- **`useShapes`** — owns `shapes: ShapeConfig[]` and `selectedId`.
  Exposes `addShape`, `updateShape`, `deleteShape` (each accept a `save`
  boolean), `commitShapes`, `setShapes`, and undo/redo wired to `useHistory`.
- **`useHistory`** — the single undo/redo mechanism. `saveHistory` records an
  **immutable snapshot** (deep-cloned) of the shapes array; `undo`/`redo` walk a
  history stack via `historyIndex`. It is wrapped by `useShapes`.
- **`useDrawing`** — freehand/arrow drawing. Holds an in-progress shape in a
  ref, calls `addShape(shape, false)` + `updateShape(..., save=false)` during
  the stroke so each pointer move does not push history, then `commitShapes()`
  on `finishDrawing` to record one snapshot.
- **`useTextEditing`** — inline text editing. Mutates `text` with `save=false`
  and commits once on `commitEditing`; `cancelEditing` restores the original
  text without saving.
- **`useCrop`** — tracks a `cropRect` (x, y, width, height) during drag;
  `applyCrop` returns the final rect. Canvas render cropping (dims + handles)
  lives in `Canvas.tsx`.
- **`useBackground`** — output background settings (linear/radial, colors,
  angle, padding), used to compose an exported image.
- **`useKeyboardShortcut`** — generic `window` keydown listener for editor
  shortcuts. App-level shortcut definitions live in `src/lib/shortcut.ts`.

### Canvas details (`Canvas.tsx`)

- Renders `Stage`/`Layer`, one shape node per `ShapeConfig`, a `Transformer`
  around the selected shape, and crop dim-rect/handles when cropping.
- Uses react-konva nodes: `Rect`, `Ellipse`, `Arrow`, `Text`, `Line`,
  `Image`, `Transformer`.
- Coordinate conversion from screen to stage space is handled via the
  `Stage.getPointerPosition` / transforms; pan/zoom helpers live in
  `src/lib/viewport.ts` (`clampPan`, `panForPointerZoom`). Read those before
  touching coordinate math.

## Rules

- **Undo/redo go through `useHistory` only.** Do not add a second history
  mechanism or a separate "previous shapes" source of truth.
- Use the `save=false` pattern during interactive editing (drag, draw, type)
  and call `commitShapes()` / a `save=true` update once at the end. This is
  what produces one history entry per completed action instead of per event.
- Reuse the existing hooks; do not duplicate their logic inside a component.
- Keep `ShapeConfig` as the single shape model. Extend it rather than creating
  parallel shape types.
- Add/edit shape types through react-konva nodes already in `Canvas.tsx`, and
  ensure new tools route through `useDrawing`/`useShapes` like existing ones.

## Workflow

1. Read the relevant hook and `Canvas.tsx` before changing behavior.
2. Implement shape mutation through `useShapes`/`useDrawing`, deferring history
   with `save=false` and committing at the interaction's end.
3. For new tool interactions, follow how an existing tool (arrow, text, crop)
   starts, updates, and finishes.
4. Type-check with `npm run build` in `frontend/`.

## Common mistakes

- Writing undo/redo outside `useHistory` (creates divergent state).
- Calling `updateShape` with `save=true` on every pointer move (history spam).
- Maintaining shapes in component-local state instead of through `useShapes`.
- Doing raw cursor→canvas math instead of using `viewport.ts` helpers.
- Adding a new shape type without updating the `ShapeConfig` union in
  `src/types/types.ts`.

## Validation

- A completed draw/drag/text edit pushes exactly one history entry.
- Undo then redo restores the exact previous `ShapeConfig` state.
- `npm run build` (in `frontend/`) passes the type-check.
- No second copy of shape or history state was added.