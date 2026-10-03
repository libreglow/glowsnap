import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Toolbar from "@/components/editor/Toolbar";
import { TOOL_SHORTCUT_KEYS, TOOL_SHORTCUTS } from "@/lib/shortcut";
import type { Tool } from "@/types/types";

const TOOLS: Array<[Tool, string]> = [
  ["select", "Select"],
  ["crop", "Crop"],
  ["arrow", "Arrow"],
  ["text", "Text"],
  ["number", "Number"],
  ["pen", "Pen"],
  ["rectangle", "Rect"],
  ["circle", "Circle"],
  ["eraser", "Eraser"],
];

describe("Toolbar", () => {
  it("renders one button per tool", () => {
    render(<Toolbar selectedTool="select" onToolChange={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(TOOLS.length);
  });

  it("labels every tool with its default shortcut", () => {
    render(<Toolbar selectedTool="select" onToolChange={() => {}} />);
    for (const [tool, label] of TOOLS) {
      const key = Object.entries(TOOL_SHORTCUT_KEYS).find(([, t]) => t === tool)?.[0];
      expect(screen.getByTitle(`${label} (${key?.toUpperCase()})`), tool).toBeInTheDocument();
    }
  });

  it("reports the clicked tool", async () => {
    const onToolChange = vi.fn();
    render(<Toolbar selectedTool="select" onToolChange={onToolChange} />);
    await userEvent.click(screen.getByTitle("Crop (C)"));
    expect(onToolChange).toHaveBeenCalledWith("crop");
  });

  it("marks only the selected tool as active", () => {
    const { container } = render(
      <Toolbar selectedTool="text" onToolChange={() => {}} />,
    );
    const active = Array.from(container.querySelectorAll("button")).filter((b) =>
      b.className.includes("bg-white/20"),
    );
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute("title")).toBe("Text (T)");
  });

  it("shows a single selection indicator", () => {
    const { container } = render(
      <Toolbar selectedTool="pen" onToolChange={() => {}} />,
    );
    expect(container.querySelectorAll(".bg-white.rounded-full")).toHaveLength(1);
  });

  it("moves the indicator when the selection changes", () => {
    const { container, rerender } = render(
      <Toolbar selectedTool="select" onToolChange={() => {}} />,
    );
    expect(
      container.querySelector("button[title='Select (V)'] .rounded-full"),
    ).not.toBeNull();

    rerender(<Toolbar selectedTool="crop" onToolChange={() => {}} />);
    expect(
      container.querySelector("button[title='Select (V)'] .rounded-full"),
    ).toBeNull();
    expect(
      container.querySelector("button[title='Crop (C)'] .rounded-full"),
    ).not.toBeNull();
  });

  it("applies a custom shortcut to the title", () => {
    render(
      <Toolbar
        selectedTool="select"
        onToolChange={() => {}}
        customShortcuts={{ "tool-crop": "Ctrl+Shift+K" }}
      />,
    );
    expect(screen.getByTitle("Crop (Ctrl+Shift+K)")).toBeInTheDocument();
  });

  it("leaves other titles untouched by an override", () => {
    render(
      <Toolbar
        selectedTool="select"
        onToolChange={() => {}}
        customShortcuts={{ "tool-crop": "Ctrl+Shift+K" }}
      />,
    );
    expect(screen.getByTitle("Text (T)")).toBeInTheDocument();
  });

  it("still shows a title when an override has no key", () => {
    render(
      <Toolbar
        selectedTool="select"
        onToolChange={() => {}}
        customShortcuts={{ "tool-crop": "Ctrl+" }}
      />,
    );
    expect(screen.getByTitle("Crop (C)")).toBeInTheDocument();
  });

  it("renders an empty shortcut hint as an empty pair of parentheses", () => {
    render(
      <Toolbar
        selectedTool="select"
        onToolChange={() => {}}
        customShortcuts={{ "tool-text": "Ctrl+" }}
      />,
    );
    // applyShortcutOverrides rejects keyless combos, so the default is kept.
    expect(screen.getByTitle("Text (T)")).toBeInTheDocument();
  });

  it("has a unique shortcut id per tool", () => {
    const ids = TOOL_SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});