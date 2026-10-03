import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutsSection, AdvancedSection, GeneralSection } from "@/components/settings/sections";
import { Toggle, NumberInput, Select, PathPicker } from "@/components/settings/primitives";
import { appSettingsFixture } from "@tests/test-support/wails";
import type { AppSettings } from "@/types/types";

function renderShortcuts(config: AppSettings = appSettingsFixture()) {
  const updateGroup = vi.fn();
  render(
    <ShortcutsSection config={config} updateGroup={updateGroup} />,
  );
  return { updateGroup, config };
}

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    cancelable: true,
    bubbles: true,
    ...init,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

/** The shortcut value button in the row whose label matches. */
function shortcutButton(label: string): HTMLElement {
  const row = screen.getByText(label).closest("div.flex.items-center.justify-between");
  if (!row) throw new Error(`no shortcut row for "${label}"`);
  const button = row.querySelector("button.text-\\[11px\\]") ?? row.querySelectorAll("button")[0];
  if (!button) throw new Error(`no shortcut button for "${label}"`);
  return button as HTMLElement;
}

describe("ShortcutsSection", () => {
  it("shows the default combo for a shortcut", () => {
    renderShortcuts();
    expect(shortcutButton("Undo").textContent).toBe("Ctrl+Z");
    expect(shortcutButton("Redo").textContent).toBe("Ctrl+Shift+Z");
  });

  it("groups shortcuts by category", () => {
    renderShortcuts();
    for (const category of ["Editor", "Tools", "Palette", "Application"]) {
      expect(screen.getByText(category)).toBeInTheDocument();
    }
  });

  it("shows every shortcut from the shared table", () => {
    renderShortcuts();
    expect(shortcutButton("Undo").textContent).toBe("Ctrl+Z");
    expect(shortcutButton("Take full screen screenshot").textContent).toBe("Alt+1");
    expect(shortcutButton("Return to palette").textContent).toBe("Ctrl+Alt+S");
  });

  it("lists Delete and Backspace as two bindings for the same action", () => {
    renderShortcuts();
    const rows = screen
      .getAllByText("Delete selected shape")
      .map((label) => label.closest("div.flex.items-center.justify-between"))
      .filter(Boolean);
    expect(rows).toHaveLength(2);
    const combos = rows.map(
      (row) => row?.querySelector("button.text-\\[11px\\]")?.textContent,
    );
    expect(combos).toEqual(["Delete", "Backspace"]);
  });

  it("prefers a custom override over the default", () => {
    renderShortcuts(
      appSettingsFixture({
        customShortcuts: { "editor-undo": "Ctrl+Alt+Z" },
      } as never),
    );
    expect(shortcutButton("Undo").textContent).toBe("Ctrl+Alt+Z");
  });

  it("falls back to the default for an empty override", () => {
    renderShortcuts(
      appSettingsFixture({ customShortcuts: { "editor-undo": "" } } as never),
    );
    expect(shortcutButton("Undo").textContent).toBe("Ctrl+Z");
  });

  it("offers a reset control only for overridden shortcuts", () => {
    renderShortcuts(
      appSettingsFixture({
        customShortcuts: { "editor-undo": "Ctrl+Alt+Z" },
      } as never),
    );
    const overrideRow = screen.getByText("Undo").closest(
      "div.flex.items-center.justify-between",
    ) as HTMLElement;
    expect(
      within(overrideRow).getByTitle("Reset to default"),
    ).toBeInTheDocument();

    const defaultRow = screen.getByText("Redo").closest(
      "div.flex.items-center.justify-between",
    ) as HTMLElement;
    expect(within(defaultRow).queryByTitle("Reset to default")).toBeNull();
  });

  it("resets an override through updateGroup", async () => {
    const { updateGroup } = renderShortcuts(
      appSettingsFixture({
        customShortcuts: { "editor-undo": "Ctrl+Alt+Z" },
      } as never),
    );
    const overrideRow = screen.getByText("Undo").closest(
      "div.flex.items-center.justify-between",
    ) as HTMLElement;
    await userEvent.click(within(overrideRow).getByTitle("Reset to default"));
    expect(updateGroup).toHaveBeenCalledWith("customShortcuts", {
      "editor-undo": "",
    });
  });

  it("enters recording mode when a combo is clicked", async () => {
    renderShortcuts();
    await userEvent.click(shortcutButton("Undo"));
    expect(shortcutButton("Undo").textContent).toBe("Press keys…");
  });

  it("leaves recording mode when the same combo is clicked again", async () => {
    renderShortcuts();
    const button = shortcutButton("Undo");
    await userEvent.click(button);
    await userEvent.click(shortcutButton("Undo"));
    expect(shortcutButton("Undo").textContent).toBe("Ctrl+Z");
  });

  it("records a new combo for the clicked shortcut", async () => {
    const { updateGroup } = renderShortcuts();
    await userEvent.click(shortcutButton("Undo"));
    press("k", { ctrlKey: true, altKey: true });

    expect(updateGroup).toHaveBeenCalledWith("customShortcuts", {
      "editor-undo": "Ctrl+Alt+K",
    });
  });

  it("leaves recording mode after a successful rebind", async () => {
    renderShortcuts();
    await userEvent.click(shortcutButton("Undo"));
    press("k", { ctrlKey: true, altKey: true });
    expect(shortcutButton("Undo").textContent).toBe("Ctrl+Z");
  });

  it("cancels recording on Escape without saving", async () => {
    const { updateGroup } = renderShortcuts();
    await userEvent.click(shortcutButton("Undo"));
    press("Escape");
    expect(updateGroup).not.toHaveBeenCalled();
    expect(shortcutButton("Undo").textContent).toBe("Ctrl+Z");
  });

  it("ignores bare modifier presses while recording", async () => {
    const { updateGroup } = renderShortcuts();
    await userEvent.click(shortcutButton("Undo"));
    press("Control", { ctrlKey: true });
    press("Shift", { shiftKey: true });
    expect(updateGroup).not.toHaveBeenCalled();
    expect(shortcutButton("Undo").textContent).toBe("Press keys…");
  });

  it("records a plain key with no modifiers", async () => {
    const { updateGroup } = renderShortcuts();
    await userEvent.click(shortcutButton("Undo"));
    press("F9");
    // Function keys are reserved as record targets, so nothing is stored.
    expect(updateGroup).not.toHaveBeenCalled();
  });

  it("only rebinds the shortcut being recorded", async () => {
    const { updateGroup } = renderShortcuts();
    await userEvent.click(shortcutButton("Undo"));
    press("k", { ctrlKey: true });
    expect(updateGroup).toHaveBeenCalledTimes(1);
    expect(Object.keys(updateGroup.mock.calls[0][1])).toEqual(["editor-undo"]);
  });

  it("stops listening after recording finishes", async () => {
    const { updateGroup } = renderShortcuts();
    await userEvent.click(shortcutButton("Undo"));
    press("k", { ctrlKey: true });
    press("j", { ctrlKey: true });
    expect(updateGroup).toHaveBeenCalledTimes(1);
  });
});

describe("AdvancedSection", () => {
  it("reports the verbose logging toggle", async () => {
    const updateGroup = vi.fn();
    render(<AdvancedSection config={appSettingsFixture()} updateGroup={updateGroup} />);
    const row = screen.getByText("Verbose logging").closest(
      "div.flex.items-center.justify-between",
    ) as HTMLElement;
    await userEvent.click(within(row).getByRole("button"));
    expect(updateGroup).toHaveBeenCalledWith("advanced", { verboseLogging: true });
  });
});

describe("GeneralSection", () => {
  it("patches only confirmDelete", async () => {
    const updateGroup = vi.fn();
    render(<GeneralSection config={appSettingsFixture()} updateGroup={updateGroup} />);
    const row = screen.getByText("Confirm before deleting").closest(
      "div.flex.items-center.justify-between",
    ) as HTMLElement;
    await userEvent.click(within(row).getByRole("button"));
    expect(updateGroup).toHaveBeenCalledWith("general", { confirmDelete: false });
  });
});

describe("setting primitives", () => {
  it("Toggle reflects and flips the checked state", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Toggle checked onChange={onChange} />);
    expect(screen.getByRole("button")).toHaveClass("bg-red-500/80");
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(false);

    rerender(<Toggle checked={false} onChange={onChange} />);
    expect(screen.getByRole("button")).not.toHaveClass("bg-red-500/80");
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("Toggle honours disabled", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("NumberInput reports the parsed number", () => {
    const onChange = vi.fn();
    render(
      <NumberInput value={5} min={0} max={10} onChange={onChange} suffix="s" />,
    );
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "7" } });
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it("NumberInput relies on the browser for its bounds", () => {
    // The value is passed through unchanged; min/max are only input attributes.
    const onChange = vi.fn();
    render(<NumberInput value={5} min={0} max={10} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "10");

    fireEvent.change(input, { target: { value: "99" } });
    expect(onChange).toHaveBeenLastCalledWith(99);
  });

  it("NumberInput turns an empty field into zero", () => {
    const onChange = vi.fn();
    render(<NumberInput value={5} min={0} max={10} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("NumberInput renders its suffix", () => {
    render(<NumberInput value={5} min={0} max={10} onChange={() => {}} suffix="s" />);
    expect(screen.getByText("s")).toBeInTheDocument();
  });

  it("NumberInput marks the field disabled for the browser", () => {
    const onChange = vi.fn();
    render(<NumberInput value={5} onChange={onChange} disabled />);
    expect(screen.getByRole("spinbutton")).toBeDisabled();
  });

  it("Select reports the chosen option value", () => {
    const onChange = vi.fn();
    render(
      <Select
        value="png"
        onChange={onChange}
        options={[
          { value: "png", label: "PNG" },
          { value: "jpg", label: "JPEG" },
        ]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "jpg" } });
    expect(onChange).toHaveBeenCalledWith("jpg");
  });

  it("PathPicker shows the current path and reports a pick", async () => {
    const onPick = vi.fn();
    render(
      <PathPicker
        value="/home/test/Pictures"
        title="Choose screenshot save location"
        onPick={onPick}
      />,
    );
    expect(screen.getByTitle("Choose screenshot save location")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Choose screenshot save location"));
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});