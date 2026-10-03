import { describe, it, expect } from "vitest";
import { cn, cloneShape } from "@/lib/utils";
import type { ShapeConfig } from "@/types/types";

function rect(overrides: Partial<ShapeConfig> = {}): ShapeConfig {
  return {
    id: "shape-1",
    type: "rect",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    fill: "#ff0000",
    ...overrides,
  };
}

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("keeps later conflicting tailwind utilities", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm text-red-500", "text-lg")).toBe("text-red-500 text-lg");
  });

  it("lets a later class override an earlier background color", () => {
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("returns an empty string for no input", () => {
    expect(cn()).toBe("");
  });
});

describe("cloneShape", () => {
  it("returns an equal but distinct object", () => {
    const original = rect();
    const clone = cloneShape(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
  });

  it("does not share nested references", () => {
    const original = rect({ points: [1, 2, 3, 4] });
    const clone = cloneShape(original);
    expect(clone.points).toEqual(original.points);
    expect(clone.points).not.toBe(original.points);
  });

  it("keeps mutations on the clone away from the original", () => {
    const original = rect();
    const clone = cloneShape(original);
    (clone as { x: number }).x = 999;
    expect(original.x).toBe(10);
  });

  it("preserves every field including optional ones", () => {
    const original = rect({ opacity: 0.5, rotation: 45 });
    const clone = cloneShape(original);
    expect(clone.opacity).toBe(0.5);
    expect(clone.rotation).toBe(45);
  });

  it("falls back to JSON cloning when structuredClone is unavailable", () => {
    const original = rect();
    const structured = globalThis.structuredClone;
    // @ts-expect-error - simulating an older runtime without structuredClone
    delete globalThis.structuredClone;
    try {
      const clone = cloneShape(original);
      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
    } finally {
      globalThis.structuredClone = structured;
    }
  });
});