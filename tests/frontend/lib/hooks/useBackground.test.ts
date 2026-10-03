import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBackground } from "@/lib/hooks/useBackground";

const INITIAL = {
  enabled: false,
  type: "linear" as const,
  startColor: "#1e1e2e",
  endColor: "#45475a",
  angle: 0,
  padding: 40,
};

describe("useBackground", () => {
  it("starts with the default background", () => {
    const { result } = renderHook(() => useBackground());
    expect(result.current.background).toEqual(INITIAL);
  });

  it("toggles enabled", () => {
    const { result } = renderHook(() => useBackground());
    act(() => result.current.toggleBackground());
    expect(result.current.background.enabled).toBe(true);
    act(() => result.current.toggleBackground());
    expect(result.current.background.enabled).toBe(false);
  });

  it("keeps other fields when toggling", () => {
    const { result } = renderHook(() => useBackground());
    act(() => result.current.setAngle(45));
    act(() => result.current.toggleBackground());
    expect(result.current.background).toEqual({ ...INITIAL, angle: 45, enabled: true });
  });

  it("switches between linear and radial", () => {
    const { result } = renderHook(() => useBackground());
    act(() => result.current.setType("radial"));
    expect(result.current.background.type).toBe("radial");
    act(() => result.current.setType("linear"));
    expect(result.current.background.type).toBe("linear");
  });

  it("sets the start and end colours independently", () => {
    const { result } = renderHook(() => useBackground());
    act(() => result.current.setStartColor("#111111"));
    expect(result.current.background.startColor).toBe("#111111");
    expect(result.current.background.endColor).toBe(INITIAL.endColor);

    act(() => result.current.setEndColor("#222222"));
    expect(result.current.background.endColor).toBe("#222222");
    expect(result.current.background.startColor).toBe("#111111");
  });

  it("sets the angle", () => {
    const { result } = renderHook(() => useBackground());
    act(() => result.current.setAngle(135));
    expect(result.current.background.angle).toBe(135);
  });

  it("sets the padding", () => {
    const { result } = renderHook(() => useBackground());
    act(() => result.current.setPadding(0));
    expect(result.current.background.padding).toBe(0);
    act(() => result.current.setPadding(120));
    expect(result.current.background.padding).toBe(120);
  });

  it("accumulates independent updates", () => {
    const { result } = renderHook(() => useBackground());
    act(() => result.current.setType("radial"));
    act(() => result.current.setStartColor("#abcdef"));
    act(() => result.current.setEndColor("#fedcba"));
    act(() => result.current.setAngle(90));
    act(() => result.current.setPadding(10));
    act(() => result.current.toggleBackground());

    expect(result.current.background).toEqual({
      enabled: true,
      type: "radial",
      startColor: "#abcdef",
      endColor: "#fedcba",
      angle: 90,
      padding: 10,
    });
  });

  it("does not mutate the previous state object", () => {
    const { result } = renderHook(() => useBackground());
    const before = result.current.background;
    act(() => result.current.setAngle(33));
    expect(before.angle).toBe(0);
    expect(result.current.background).not.toBe(before);
  });
});