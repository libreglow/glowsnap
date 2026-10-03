import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCrop } from "@/lib/hooks/useCrop";

describe("useCrop", () => {
  it("starts with no crop rectangle", () => {
    const { result } = renderHook(() => useCrop());
    expect(result.current.cropRect).toBeNull();
  });

  it("starts a zero-sized rectangle at the press point", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 10, y: 20 }));
    expect(result.current.cropRect).toEqual({ x: 10, y: 20, width: 0, height: 0 });
  });

  it("grows the rectangle while dragging right and down", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 10, y: 20 }));
    act(() => result.current.updateCrop({ x: 60, y: 80 }));
    expect(result.current.cropRect).toEqual({ x: 10, y: 20, width: 50, height: 60 });
  });

  it("normalises a drag up and to the left", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 100, y: 100 }));
    act(() => result.current.updateCrop({ x: 40, y: 25 }));
    expect(result.current.cropRect).toEqual({ x: 40, y: 25, width: 60, height: 75 });
  });

  it("normalises a diagonal drag", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 0, y: 100 }));
    act(() => result.current.updateCrop({ x: 50, y: 20 }));
    expect(result.current.cropRect).toEqual({ x: 0, y: 20, width: 50, height: 80 });
  });

  it("always measures from the original press point", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 50, y: 50 }));
    act(() => result.current.updateCrop({ x: 70, y: 50 }));
    act(() => result.current.updateCrop({ x: 30, y: 50 }));
    expect(result.current.cropRect).toEqual({ x: 30, y: 50, width: 20, height: 0 });
  });

  it("supports negative coordinates", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: -30, y: -30 }));
    act(() => result.current.updateCrop({ x: -10, y: 10 }));
    expect(result.current.cropRect).toEqual({ x: -30, y: -30, width: 20, height: 40 });
  });

  it("ignores updates before a drag starts", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.updateCrop({ x: 10, y: 10 }));
    expect(result.current.cropRect).toBeNull();
  });

  it("stops following the pointer after finishCrop", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 0, y: 0 }));
    act(() => result.current.updateCrop({ x: 10, y: 10 }));
    act(() => result.current.finishCrop());
    const frozen = result.current.cropRect;
    act(() => result.current.updateCrop({ x: 999, y: 999 }));
    expect(result.current.cropRect).toEqual(frozen);
  });

  it("keeps the rectangle after finishCrop so it can still be applied", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 5, y: 5 }));
    act(() => result.current.updateCrop({ x: 25, y: 35 }));
    act(() => result.current.finishCrop());
    expect(result.current.cropRect).toEqual({ x: 5, y: 5, width: 20, height: 30 });
  });

  it("applyCrop returns the rectangle and clears it", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 5, y: 5 }));
    act(() => result.current.updateCrop({ x: 25, y: 35 }));
    act(() => result.current.finishCrop());

    const applied: { value: ReturnType<typeof result.current.applyCrop> } = {
      value: undefined as unknown as ReturnType<typeof result.current.applyCrop>,
    };
    act(() => {
      applied.value = result.current.applyCrop();
    });
    expect(applied.value).toEqual({ x: 5, y: 5, width: 20, height: 30 });
    expect(result.current.cropRect).toBeNull();
  });

  it("applyCrop returns null when nothing was selected", () => {
    const { result } = renderHook(() => useCrop());
    let applied: unknown = "unset";
    act(() => {
      applied = result.current.applyCrop();
    });
    expect(applied).toBeNull();
  });

  it("cancelCrop discards the rectangle", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 5, y: 5 }));
    act(() => result.current.updateCrop({ x: 25, y: 35 }));
    act(() => result.current.cancelCrop());
    expect(result.current.cropRect).toBeNull();
  });

  it("cancelCrop also stops the drag", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 5, y: 5 }));
    act(() => result.current.cancelCrop());
    act(() => result.current.updateCrop({ x: 50, y: 50 }));
    expect(result.current.cropRect).toBeNull();
  });

  it("can start a new drag after cancelling", () => {
    const { result } = renderHook(() => useCrop());
    act(() => result.current.startCrop({ x: 0, y: 0 }));
    act(() => result.current.cancelCrop());
    act(() => result.current.startCrop({ x: 200, y: 300 }));
    act(() => result.current.updateCrop({ x: 250, y: 350 }));
    expect(result.current.cropRect).toEqual({ x: 200, y: 300, width: 50, height: 50 });
  });
});