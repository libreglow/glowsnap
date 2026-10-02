import type { ResolutionLimits } from "@/types/types";

export const CUSTOM_RESOLUTION = "custom";

export function parseDimension(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function validateCustomDimension(
  width: string,
  height: string,
  limits?: ResolutionLimits | null,
): string {
  const w = parseDimension(width);
  const h = parseDimension(height);
  if (w === null || h === null) {
    return "Enter a positive whole number for width and height.";
  }
  if (w % 2 !== 0 || h % 2 !== 0) {
    return "Width and height must be even numbers.";
  }
  if (limits) {
    if (w < limits.minWidth || h < limits.minHeight) {
      return `Minimum is ${limits.minWidth}×${limits.minHeight}.`;
    }
    if (w > limits.maxWidth || h > limits.maxHeight) {
      return `Maximum is ${limits.maxWidth}×${limits.maxHeight}.`;
    }
  }
  return "";
}
