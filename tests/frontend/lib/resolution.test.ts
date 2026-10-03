import { describe, it, expect } from "vitest";
import {
  parseDimension,
  validateCustomDimension,
  CUSTOM_RESOLUTION,
} from "@/lib/resolution";
import type { ResolutionLimits } from "@/types/types";

const LIMITS: ResolutionLimits = {
  minWidth: 16,
  minHeight: 16,
  maxWidth: 3840,
  maxHeight: 2160,
};

describe("CUSTOM_RESOLUTION", () => {
  it("matches the backend resolution key", () => {
    expect(CUSTOM_RESOLUTION).toBe("custom");
  });
});

describe("parseDimension", () => {
  it("parses positive whole numbers", () => {
    expect(parseDimension("1920")).toBe(1920);
    expect(parseDimension("1")).toBe(1);
    expect(parseDimension("3840")).toBe(3840);
  });

  it("trims surrounding whitespace", () => {
    expect(parseDimension("  800  ")).toBe(800);
    expect(parseDimension("\t720\n")).toBe(720);
  });

  it("keeps leading zeros as the numeric value", () => {
    expect(parseDimension("0080")).toBe(80);
  });

  it("rejects zero and negatives", () => {
    expect(parseDimension("0")).toBeNull();
    expect(parseDimension("-1")).toBeNull();
    expect(parseDimension("-1920")).toBeNull();
  });

  it("rejects decimals", () => {
    expect(parseDimension("1920.5")).toBeNull();
    expect(parseDimension("1.0")).toBeNull();
  });

  it("rejects non-numeric text", () => {
    expect(parseDimension("")).toBeNull();
    expect(parseDimension("   ")).toBeNull();
    expect(parseDimension("abc")).toBeNull();
    expect(parseDimension("1920px")).toBeNull();
    expect(parseDimension("1e3")).toBeNull();
    expect(parseDimension("+100")).toBeNull();
  });

  it("rejects unsafe integers", () => {
    expect(parseDimension("99999999999999999999")).toBeNull();
  });
});

describe("validateCustomDimension without limits", () => {
  it("accepts valid dimensions", () => {
    expect(validateCustomDimension("1920", "1080")).toBe("");
    expect(validateCustomDimension("16", "16")).toBe("");
  });

  it("reports a generic message when either value is unparsable", () => {
    expect(validateCustomDimension("", "1080")).toBe(
      "Enter a positive whole number for width and height.",
    );
    expect(validateCustomDimension("1920", "abc")).toBe(
      "Enter a positive whole number for width and height.",
    );
    expect(validateCustomDimension("0", "0")).toBe(
      "Enter a positive whole number for width and height.",
    );
  });

  it("reports odd dimensions", () => {
    expect(validateCustomDimension("1921", "1080")).toBe(
      "Width and height must be even numbers.",
    );
    expect(validateCustomDimension("1920", "1081")).toBe(
      "Width and height must be even numbers.",
    );
  });

  it("does not range check when limits are absent", () => {
    expect(validateCustomDimension("100000", "99998")).toBe("");
    expect(validateCustomDimension("2", "2")).toBe("");
  });

  it("treats null limits as absent", () => {
    expect(validateCustomDimension("100000", "99998", null)).toBe("");
  });
});

describe("validateCustomDimension with backend limits", () => {
  it("accepts dimensions inside the limits", () => {
    expect(validateCustomDimension("1920", "1080", LIMITS)).toBe("");
    expect(validateCustomDimension("16", "16", LIMITS)).toBe("");
    expect(validateCustomDimension("3840", "2160", LIMITS)).toBe("");
  });

  it("reports the minimum when either axis is too small", () => {
    expect(validateCustomDimension("8", "16", LIMITS)).toBe("Minimum is 16×16.");
    expect(validateCustomDimension("16", "8", LIMITS)).toBe("Minimum is 16×16.");
  });

  it("reports the maximum when either axis is too large", () => {
    expect(validateCustomDimension("3842", "2160", LIMITS)).toBe(
      "Maximum is 3840×2160.",
    );
    expect(validateCustomDimension("3840", "2162", LIMITS)).toBe(
      "Maximum is 3840×2160.",
    );
  });

  it("checks format before range", () => {
    expect(validateCustomDimension("3", "3", LIMITS)).toBe(
      "Width and height must be even numbers.",
    );
    expect(validateCustomDimension("x", "3", LIMITS)).toBe(
      "Enter a positive whole number for width and height.",
    );
  });

  it("checks evenness before range", () => {
    expect(validateCustomDimension("9", "16", LIMITS)).toBe(
      "Width and height must be even numbers.",
    );
  });

  it("mirrors the backend 16..3840 x 16..2160 window", () => {
    for (let w = 2; w <= 4000; w += 2) {
      const h = 1080;
      const frontendValid = validateCustomDimension(String(w), String(h), LIMITS) === "";
      const backendValid = w >= 16 && w <= 3840;
      expect(frontendValid).toBe(backendValid);
    }
  });
});