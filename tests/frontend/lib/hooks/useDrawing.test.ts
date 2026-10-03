import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDrawing } from "@/lib/hooks/useDrawing";
import type { ShapeConfig, Tool } from "@/types/types";

interface Harness {
  addShape: ReturnType<typeof vi.fn>;
  updateShape: ReturnType<typeof vi.fn>;
  commitShapes: ReturnType<typeof vi.fn>;
  shapes: ShapeConfig[];
  api: ReturnType<typeof useDrawing>;
}

function setup(): Harness {
  const addShape = vi.fn();
  const updateShape = vi.fn();
  const commitShapes = vi.fn();
  const shapes: ShapeConfig[] = [];
  const { result } = renderHook(
    ({ s }) => useDrawing(addShape, updateShape, s, commitShapes),
    { initialProps: { s: shapes } },
  );
  return { addShape, updateShape, commitShapes, shapes, api: result.current };
}

describe("useDrawing", () => {
  it("adds an unselected line shape at the press point", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 12, y: 34 }, "#ff0000", 4, 0.8));

    expect(h.addShape).toHaveBeenCalledTimes(1);
    const [shape, select] = h.addShape.mock.calls[0];
    expect(select).toBe(false);
    expect(shape.points).toEqual([12, 34]);
    expect(shape.stroke).toBe("#ff0000");
    expect(shape.strokeWidth).toBe(4);
    expect(shape.opacity).toBe(0.8);
    expect(shape.fill).toBe("transparent");
    expect(shape.x).toBe(0);
    expect(shape.y).toBe(0);
  });

  it("creates a line shape for drawing tools", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    expect(h.addShape.mock.calls[0][0].type).toBe("line");
  });

  it("creates an arrow shape when the arrow tool is active", () => {
    const h = setup();
    act(() => h.api.startDrawing("arrow", { x: 0, y: 0 }, "#000", 2, 1));
    expect(h.addShape.mock.calls[0][0].type).toBe("arrow");
  });

  it("derives the stroke id from the current time", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
      const h = setup();
      act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
      const first = h.addShape.mock.calls[0][0] as ShapeConfig;
      expect(first.id).toBe(Date.now().toString(36));
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives strokes started at different times distinct ids", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
      const h = setup();
      act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
      vi.setSystemTime(new Date("2024-01-01T00:00:05Z"));
      act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
      const [first, second] = h.addShape.mock.calls.map((call) => call[0] as ShapeConfig);
      expect(first.id).not.toBe(second.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports the stroke from its press point to the current pointer", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    const id = (h.addShape.mock.calls[0][0] as ShapeConfig).id;

    act(() => h.api.updateDrawing({ x: 10, y: 10 }));
    expect(h.updateShape).toHaveBeenLastCalledWith(id, { points: [0, 0, 10, 10] }, false);
  });

  it("always measures from the press point, not the previous sample", () => {
    // drawingRef keeps the shape created in startDrawing, so each update emits
    // the press point plus the latest pointer position.
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 5, y: 5 }, "#000", 2, 1));

    act(() => h.api.updateDrawing({ x: 10, y: 10 }));
    act(() => h.api.updateDrawing({ x: 20, y: 25 }));
    const id = (h.addShape.mock.calls[0][0] as ShapeConfig).id;
    expect(h.updateShape).toHaveBeenLastCalledWith(id, { points: [5, 5, 20, 25] }, false);
  });

  it("produces a straight segment for repeated samples at the same place", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    const id = (h.addShape.mock.calls[0][0] as ShapeConfig).id;

    act(() => h.api.updateDrawing({ x: 7, y: 7 }));
    act(() => h.api.updateDrawing({ x: 7, y: 7 }));
    expect(h.updateShape).toHaveBeenLastCalledWith(id, { points: [0, 0, 7, 7] }, false);
  });

  it("updates without saving history", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    act(() => h.api.updateDrawing({ x: 1, y: 1 }));
    expect(h.updateShape.mock.calls[0][2]).toBe(false);
  });

  it("ignores updates when no stroke is active", () => {
    const h = setup();
    act(() => h.api.updateDrawing({ x: 5, y: 5 }));
    expect(h.updateShape).not.toHaveBeenCalled();
  });

  it("commits history once when finishing a stroke", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    act(() => h.api.updateDrawing({ x: 5, y: 5 }));
    act(() => h.api.finishDrawing());
    expect(h.commitShapes).toHaveBeenCalledTimes(1);
  });

  it("does not commit twice for the same stroke", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    act(() => h.api.finishDrawing());
    act(() => h.api.finishDrawing());
    expect(h.commitShapes).toHaveBeenCalledTimes(1);
  });

  it("does not commit when nothing was drawn", () => {
    const h = setup();
    act(() => h.api.finishDrawing());
    expect(h.commitShapes).not.toHaveBeenCalled();
  });

  it("stops updating the finished stroke", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    act(() => h.api.updateDrawing({ x: 5, y: 5 }));
    act(() => h.api.finishDrawing());
    h.updateShape.mockClear();

    act(() => h.api.updateDrawing({ x: 9, y: 9 }));
    expect(h.updateShape).not.toHaveBeenCalled();
  });

  it("cancelDrawing discards the stroke without committing", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    act(() => h.api.cancelDrawing());
    act(() => h.api.finishDrawing());
    expect(h.commitShapes).not.toHaveBeenCalled();
  });

  it("starts a fresh stroke after cancelling", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    act(() => h.api.cancelDrawing());
    act(() => h.api.startDrawing("arrow", { x: 7, y: 8 }, "#fff", 1, 1));

    expect(h.addShape).toHaveBeenCalledTimes(2);
    expect(h.addShape.mock.calls[1][0].points).toEqual([7, 8]);
    expect(h.addShape.mock.calls[1][0].type).toBe("arrow");

    act(() => h.api.updateDrawing({ x: 9, y: 9 }));
    const id = (h.addShape.mock.calls[1][0] as ShapeConfig).id;
    expect(h.updateShape).toHaveBeenLastCalledWith(id, { points: [7, 8, 9, 9] }, false);
  });

  it("does not modify the shapes array it was given", () => {
    const h = setup();
    act(() => h.api.startDrawing("pen", { x: 0, y: 0 }, "#000", 2, 1));
    act(() => h.api.updateDrawing({ x: 3, y: 4 }));
    expect(h.shapes).toEqual([]);
  });

  it("supports the eraser tool as a stroke", () => {
    const h = setup();
    const tool: Tool = "eraser";
    act(() => h.api.startDrawing(tool, { x: 1, y: 2 }, "#000", 3, 1));
    expect(h.addShape.mock.calls[0][0].strokeWidth).toBe(3);
  });
});