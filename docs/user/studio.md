# Screenshot Studio

The Studio is GlowSnap's screenshot gallery. It lists everything in your
screenshot folder, lets you search, sort, star and organise it, and opens any
capture in the visual editor.

<p align="center">
  <img src="../images/studio.png" width="800" alt="GlowSnap Studio">
</p>

---

## Opening the Studio

- Click **Studio** in the palette.
- Press `Alt+4` while the palette is focused.

The Studio window is maximised. Use the **Studio / Record** switch in the header
to move between the screenshot gallery and the recording gallery, and the
**← Palette** button to go back.

---

## Browsing

The gallery shows a grid of thumbnails for every image in your screenshot
folder (`.png`, `.jpg`, `.jpeg`, `.webp` and `.bmp` files are picked up).

Each card shows:

- the thumbnail,
- the file name,
- the capture date and time,
- the file size.

The grid loads in pages of 50 — use **Load More** to reveal the rest of a large
folder.

Use **Refresh** to re-scan the folder after adding files from outside
GlowSnap.

---

## Searching

Type into the **Search** box in the header. The list filters by file name as
you type (the query is debounced, so there is no lag while you type).

The filter combines with the sort order and the favourites filter.

---

## Sorting

The dropdown next to the search box offers four orders:

| Order | Meaning |
| ----- | ------- |
| **Newest** | Most recent capture first |
| **Oldest** | Oldest capture first |
| **A–Z** | File name ascending |
| **Z–A** | File name descending |

---

## Favourites

Click the **★** on a card to mark it as a favourite. Favourites are highlighted
in yellow.

Click the **★** in the header to toggle *show favourites only*. Screenshot
favourites are remembered by GlowSnap between sessions.

---

## Renaming

Double-click the file name on a card to rename it. Press `Enter` to confirm or
click away to commit the change.

If you leave the extension out, GlowSnap keeps the original one so the file
stays a valid image. Renaming a capture also moves it along in your favourites
list.

---

## Deleting

Click the **✕** on a card to delete the capture.

When **Settings → General → Confirm before deleting** is enabled (the default),
GlowSnap asks for confirmation first.

> Deleted captures are removed from disk. There is no undo for deletions.

---

## Editing a capture

Click a thumbnail to open it in the [Visual Editor](./editor.md). The editor
works on the image in memory — your original file on disk is never modified
unless you export it yourself.

Press **← Back** (top-left of the editor) to return to the gallery.

---

## The recording gallery

The **Record** tab of the Studio shows your recordings instead:

- thumbnails are generated automatically in the background the first time a
  recording is listed,
- clicking a recording opens it in the built-in video player,
- the same search, sort, favourites, rename and delete actions are available.

See [Screen recording](./recording.md).
