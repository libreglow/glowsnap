import { describe, it, expect } from "vitest";
import {
  clampPan,
  clampPanSoft,
  panForPointerZoom,
  type ViewportParams,
} from "@/lib/viewport";

// Content is larger than the stage so panning is meaningful, and zoom < 1 so the
// centering offsets are non-zero and actually get exercised.
const PANNABLE: ViewportParams = {
  contentWidth: 2000,
  contentHeight: 2000,
  stageWidth: 800,
  stageHeight: 600,
  zoom: 0.5,
  offsetX: 0,
  offsetY: 0,
};

function bounds(p: ViewportParams) {
  const cx = (p.stageWidth * (1 - p.zoom)) / 2;
  const cy = (p.stageHeight * (1 - p.zoom)) / 2;
  return {
    minX: -cx - (p.offsetX + p.contentWidth) * p.zoom,
    maxX: p.stageWidth - cx - p.offsetX * p.zoom,
    minY: -cy - (p.offsetY + p.contentHeight) * p.zoom,
    maxY: p.stageHeight - cy - p.offsetY * p.zoom,
  };
}

describe("clampPan", () => {
  it("keeps a pan that is already inside the limits", () => {
    expect(clampPan({ x: 0, y: 0 }, PANNABLE)).toEqual({ x: 0, y: 0 });
  });

  it("clamps beyond the maximum on both axes", () => {
    const b = bounds(PANNABLE);
    expect(clampPan({ x: 99999, y: 99999 }, PANNABLE)).toEqual({ x: b.maxX, y: b.maxY });
  });

  it("clamps beyond the minimum on both axes", () => {
    const b = bounds(PANNABLE);
    expect(clampPan({ x: -99999, y: -99999 }, PANNABLE)).toEqual({ x: b.minX, y: b.minY });
  });

  it("centers the axis that fits on screen", () => {
    const fits: ViewportParams = {
      contentWidth: 400, // 400 * 1 === 800 -> fits exactly
      contentHeight: 1000,
      stageWidth: 800,
      stageHeight: 600,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    };
    expect(clampPan({ x: 250, y: -40 }, fits)).toEqual({ x: 0, y: -40 });
  });

  it("centers the axis that is smaller than the stage at any zoom", () => {
    const fits: ViewportParams = {
      contentWidth: 100,
      contentHeight: 100,
      stageWidth: 800,
      stageHeight: 600,
      zoom: 2,
      offsetX: 0,
      offsetY: 0,
    };
    expect(clampPan({ x: 120, y: -80 }, fits)).toEqual({ x: 0, y: 0 });
  });

  it("honours a non-zero content offset when computing limits", () => {
    const p: ViewportParams = { ...PANNABLE, offsetX: 30, offsetY: 15 };
    const b = bounds(p);
    expect(clampPan({ x: 5000, y: 5000 }, p)).toEqual({ x: b.maxX, y: b.maxY });
    expect(clampPan({ x: -5000, y: -5000 }, p)).toEqual({ x: b.minX, y: b.minY });
  });

  it("stays inside limits for a sweep of pans and viewports", () => {
    for (const zoom of [0.25, 0.5, 1, 2]) {
      for (const offsetX of [0, 25]) {
        for (const offsetY of [0, 25]) {
          const p: ViewportParams = { ...PANNABLE, zoom, offsetX, offsetY };
          const b = bounds(p);
          for (const x of [-5000, -100, 0, 100, 5000]) {
            for (const y of [-5000, -100, 0, 100, 5000]) {
              const got = clampPan({ x, y }, p);
              const fitsX = p.contentWidth * p.zoom <= p.stageWidth;
              const fitsY = p.contentHeight * p.zoom <= p.stageHeight;
              if (!fitsX) expect(got.x, `zoom=${zoom} x=${x}`).toBeGreaterThanOrEqual(b.minX - 1e-9);
              if (!fitsX) expect(got.x, `zoom=${zoom} x=${x}`).toBeLessThanOrEqual(b.maxX + 1e-9);
              if (!fitsY) expect(got.y, `zoom=${zoom} y=${y}`).toBeGreaterThanOrEqual(b.minY - 1e-9);
              if (!fitsY) expect(got.y, `zoom=${zoom} y=${y}`).toBeLessThanOrEqual(b.maxY + 1e-9);
              if (fitsX) expect(got.x).toBe(0);
              if (fitsY) expect(got.y).toBe(0);
            }
          }
        }
      }
    }
  });
});

describe("clampPanSoft", () => {
  it("clamps to the same limits as clampPan for a pannable viewport", () => {
    for (const next of [
      { x: 0, y: 0 },
      { x: 4000, y: -4000 },
      { x: -12, y: 900 },
    ]) {
      expect(clampPanSoft(next, PANNABLE)).toEqual(clampPan(next, PANNABLE));
    }
  });

  it("never pins an axis to zero even when the content fits", () => {
    const fits: ViewportParams = {
      contentWidth: 100,
      contentHeight: 100,
      stageWidth: 800,
      stageHeight: 600,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    };
    expect(clampPan({ x: 0, y: 0 }, fits)).toEqual({ x: 0, y: 0 });
    // The soft variant always applies the numeric limits, so a non-zero request
    // is retained instead of being forced to 0.
    const result = clampPanSoft({ x: 40, y: -30 }, fits);
    expect(result.x).toBe(40);
    expect(result.y).toBe(-30);
  });

  it("still clamps oversized requests on a fitting viewport", () => {
    const fits: ViewportParams = {
      contentWidth: 100,
      contentHeight: 100,
      stageWidth: 800,
      stageHeight: 600,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    };
    const b = bounds(fits);
    expect(clampPanSoft({ x: 5000, y: 5000 }, fits)).toEqual({ x: b.maxX, y: b.maxY });
    expect(clampPanSoft({ x: -5000, y: -5000 }, fits)).toEqual({ x: b.minX, y: b.minY });
  });

  it("tolerates inverted bounds without producing NaN", () => {
    // zoomed far out, the computed min can exceed the max; the nested Math.min /
    // Math.max pair must still return a finite number.
    const p: ViewportParams = {
      contentWidth: 0,
      contentHeight: 0,
      stageWidth: 800,
      stageHeight: 600,
      zoom: 0.1,
      offsetX: 0,
      offsetY: 0,
    };
    const got = clampPanSoft({ x: 10, y: 10 }, p);
    expect(Number.isFinite(got.x)).toBe(true);
    expect(Number.isFinite(got.y)).toBe(true);
  });
});

describe("panForPointerZoom", () => {
  const zoom = 1;
  const newZoom = 2;

  it("returns the same pan when the zoom does not change", () => {
    const pan = { x: 40, y: 20 };
    expect(panForPointerZoom({ x: 100, y: 100 }, pan, zoom, zoom, 800, 600)).toEqual(pan);
  });

  it("keeps the content point under the pointer fixed", () => {
    const pointer = { x: 250, y: 130 };
    const pan = { x: 40, y: 20 };
    const next = panForPointerZoom(pointer, pan, zoom, newZoom, 800, 600);

    // Local content coordinate under the pointer, before and after the zoom.
    const cx1 = (pointer.x - (800 * (1 - zoom)) / 2 - pan.x) / zoom;
    const cy1 = (pointer.y - (600 * (1 - zoom)) / 2 - pan.y) / zoom;
    const cx2 = (pointer.x - (800 * (1 - newZoom)) / 2 - next.x) / newZoom;
    const cy2 = (pointer.y - (600 * (1 - newZoom)) / 2 - next.y) / newZoom;

    expect(cx2).toBeCloseTo(cx1, 6);
    expect(cy2).toBeCloseTo(cy1, 6);
  });

  it("preserves the pointer anchor for zoom-out as well", () => {
    const pointer = { x: 610, y: 470 };
    const pan = { x: -120, y: 60 };
    const next = panForPointerZoom(pointer, pan, 2, 0.5, 800, 600);

    const cx1 = (pointer.x - (800 * (1 - 2)) / 2 - pan.x) / 2;
    const cy1 = (pointer.y - (600 * (1 - 2)) / 2 - pan.y) / 2;
    const cx2 = (pointer.x - (800 * (1 - 0.5)) / 2 - next.x) / 0.5;
    const cy2 = (pointer.y - (600 * (1 - 0.5)) / 2 - next.y) / 0.5;

    expect(cx2).toBeCloseTo(cx1, 6);
    expect(cy2).toBeCloseTo(cy1, 6);
  });

  it("keeps a zero pan stable when the pointer is at the stage centre", () => {
    // At the centre the centring offsets are symmetric, so a centred pointer
    // with no pan keeps the content centred.
    const next = panForPointerZoom({ x: 400, y: 300 }, { x: 0, y: 0 }, 1, 2, 800, 600);
    expect(next.x).toBeCloseTo(0, 6);
    expect(next.y).toBeCloseTo(0, 6);
  });
});