# Visual Editor

The Visual Editor turns a raw capture into a polished visual. It is a Konva
canvas with annotation tools built specifically for screenshots.

<p align="center">
  <img src="../images/editor.png" width="800" alt="GlowSnap Editor">
</p>

---

## Opening the editor

Click a thumbnail in the [Studio](./studio.md) to open it in the editor. The
editor always works on a copy in memory — your original file on disk is not
modified unless you export it yourself.

---

## Tools

The toolbar sits at the top of the editor. Each tool has a single-key
shortcut.

| Tool | Key | What it does |
| ---- | --- | ------------ |
| **Select** | `V` | Select, move, rotate and resize existing shapes |
| **Crop** | `C` | Crop the image to a region |
| **Arrow** | `A` | Draw an arrow from one point to another |
| **Text** | `T` | Place a text box |
| **Pen** | `P` | Free-hand drawing |
| **Rectangle** | `R` | Draw a rectangle (outline or filled) |
| **Circle** | `O` | Draw a circle / ellipse |
| **Eraser** | `E` | Erase shapes you drag over |

---

## Options bar

The bar under the toolbar controls the style of the tool you are about to use
(or the shape you currently have selected):

- **Color** — any custom color
- **Stroke width** — thickness of lines and outlines
- **Opacity** — 0–100%
- **Fill** — switch rectangles and circles between outline and filled
- **Font family** — pick the typeface for text
- **Font size** — in pixels
- **Bold**, *Italic*, **Underline**, **Strikethrough**
- **Alignment** — left, center or right
- **Line height** and **Letter spacing**

When you select an existing shape, the bar reflects that shape's current style,
and changing it updates the shape immediately.

---

## Text

1. Select the **Text** tool (`T`) and click on the image.
2. A text box is created and the inline editor opens with the caret placed
   inside it.
3. Type your text. `Enter` commits the text, `Shift+Enter` inserts a new line,
   `Escape` cancels the edit. Clicking away also commits it.

Double-click an existing text shape to edit it again, or select it and press
`Enter`. Select it and press `Delete`/`Backspace` to remove it.

---

## Crop

1. Select the **Crop** tool (`C`).
2. Drag a rectangle over the area you want to keep.
3. Press **Apply Crop** to keep the region, or **Cancel** to discard it.

Cropping replaces the working image; the original file on disk is untouched.

---

## Background

The background control adds a gradient behind the image — handy for turning a
raw screenshot into a mockup.

- Toggle the background on and off
- **Linear** or **radial** gradient
- Start and end colors
- Gradient angle (linear only)
- Padding around the image

---

## Canvas navigation

| Action | How |
| ------ | --- |
| Zoom in / out | `Ctrl` + `+` / `Ctrl` + `-`, or `Ctrl` + mouse wheel |
| Pan | Drag with the middle mouse button, or drag an empty area of the canvas with the Select tool |
| Zoom range | Clamped between 25% and 400% |

---

## History

| Action | Shortcut |
| ------ | -------- |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` or `Ctrl+Y` |

Undo/redo covers shape creation, deletion, edits and text changes.

---

## Shape operations

| Action | Shortcut |
| ------ | -------- |
| Duplicate the selected shape | `Ctrl+D` |
| Copy the selected shape | `Ctrl+C` |
| Paste the copied shape | `Ctrl+V` |
| Delete the selected shape | `Delete` / `Backspace` |
| Deselect everything | `Escape` |

A floating toolbar appears next to a selected shape with quick access to color,
font, size, opacity, fill, duplicate and delete.

---

## Export

| Action | Shortcut | Result |
| ------ | -------- | ------ |
| **Export image** | `Ctrl+S` | Opens a save dialog and writes a PNG |
| **Copy image** | — | Copies the whole canvas (2× pixel ratio) to the clipboard |

The export dialog defaults to a name like `edited-<timestamp>.png` and lets you
choose any location. The original capture is never modified.
