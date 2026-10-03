import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPanel from "@/components/SettingsPanel";
import {
  appSettingsFixture,
  wailsModuleMock,
  RESOLUTION_PRESETS,
  CUSTOM_RESOLUTION_LIMITS,
  type WailsModule,
} from "@tests/test-support/wails";

// The factory is hoisted, so the helper is imported lazily inside it.
vi.mock("@wailsjs/go/main/App", async () => {
  const { wailsModuleMock } = await import("@tests/test-support/wails");
  return wailsModuleMock();
});

const App = await import("@wailsjs/go/main/App");

function wails(): WailsModule {
  return App as unknown as WailsModule;
}

const SECTION_NAMES = [
  "General",
  "Screenshots",
  "Recording",
  "Microphone",
  "Editor",
  "Shortcuts",
  "Advanced",
  "About",
];

/** The clickable control rendered on the right of a SettingRow. */
function rowControl(label: string): HTMLElement {
  const row = screen.getByText(label).closest("div.flex.items-center.justify-between");
  if (!row) throw new Error(`no setting row for "${label}"`);
  const control = row.querySelector("button, input, select");
  if (!control) throw new Error(`no control for "${label}"`);
  return control as HTMLElement;
}

function isToggleOn(label: string): boolean {
  return rowControl(label).className.includes("bg-red-500/80");
}

async function renderPanel(onBack = vi.fn()) {
  const view = render(<SettingsPanel onBack={onBack} />);
  await waitFor(() => expect(screen.queryByText("Settings")).toBeInTheDocument());
  await waitFor(() =>
    expect(wails().GetSettings).toHaveBeenCalledTimes(1),
  );
  return { onBack, ...view };
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wails().GetSettings.mockResolvedValue(appSettingsFixture());
    wails().GetAppVersion.mockResolvedValue("1.2.3");
    wails().GetResolutionPresets.mockResolvedValue(RESOLUTION_PRESETS);
    wails().GetCustomResolutionLimits.mockResolvedValue(CUSTOM_RESOLUTION_LIMITS);
    wails().UpdateSettings.mockImplementation(async (next: unknown) => next);
    wails().ResetSettings.mockResolvedValue(appSettingsFixture());
  });

  it("loads settings, version, presets and limits in parallel", async () => {
    await renderPanel();
    expect(wails().GetSettings).toHaveBeenCalledTimes(1);
    expect(wails().GetAppVersion).toHaveBeenCalledTimes(1);
    expect(wails().GetResolutionPresets).toHaveBeenCalledTimes(1);
    expect(wails().GetCustomResolutionLimits).toHaveBeenCalledTimes(1);
  });

  it("renders a spinner while loading and the section afterwards", async () => {
    let resolveSettings: (v: unknown) => void = () => {};
    wails().GetSettings.mockReturnValue(
      new Promise((resolve) => {
        resolveSettings = resolve;
      }),
    );
    render(<SettingsPanel onBack={vi.fn()} />);

    expect(document.querySelector(".animate-spin")).not.toBeNull();
    resolveSettings(appSettingsFixture());
    await waitFor(() =>
      expect(screen.getByText("Confirm before deleting")).toBeInTheDocument(),
    );
    expect(document.querySelector(".animate-spin")).toBeNull();
  });

  it("lists every settings category", async () => {
    await renderPanel();
    const nav = screen.getByRole("button", { name: "General" }).closest(
      "nav",
    ) as HTMLElement;
    const labels = within(nav)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(labels).toEqual(SECTION_NAMES);
  });

  it("shows the General section by default", async () => {
    await renderPanel();
    expect(screen.getByText("Confirm before deleting")).toBeInTheDocument();
    expect(screen.queryByText("Filename pattern")).not.toBeInTheDocument();
  });

  it("switches to the Screenshots section", async () => {
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Screenshots" }));
    expect(screen.getByText("Filename pattern")).toBeInTheDocument();
    expect(screen.queryByText("Confirm before deleting")).not.toBeInTheDocument();
  });

  it("switches to the Recording section with backend presets", async () => {
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Recording" }));
    expect(screen.getByText(/Save location/)).toBeInTheDocument();
  });

  it("switches to the Shortcuts section", async () => {
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Shortcuts" }));
    expect(
      screen.getByText("Edit selected text"),
    ).toBeInTheDocument();
    expect(screen.getByText("Take full screen screenshot")).toBeInTheDocument();
  });

  it("shows the app version in the About section", async () => {
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "About" }));
    await waitFor(() =>
      expect(screen.getByText(/Version 1\.2\.3/)).toBeInTheDocument(),
    );
  });

  it("persists a toggle change through UpdateSettings", async () => {
    await renderPanel();
    await userEvent.click(rowControl("Confirm before deleting"));

    await waitFor(() => expect(wails().UpdateSettings).toHaveBeenCalledTimes(1));
    const sent = wails().UpdateSettings.mock.calls[0][0];
    expect(sent.general.confirmDelete).toBe(false);
  });

  it("keeps the other groups intact when patching one group", async () => {
    await renderPanel();
    await userEvent.click(rowControl("Confirm before deleting"));
    await waitFor(() => expect(wails().UpdateSettings).toHaveBeenCalled());
    const sent = wails().UpdateSettings.mock.calls[0][0];
    expect(sent.screenshot.filenamePattern).toBe("screenshot_{date}");
    expect(sent.recording.resolution).toBe("1080p");
    expect(sent.editor.defaultFont).toBe("Inter");
  });

  it("adopts the settings object the backend returns", async () => {
    const saved = appSettingsFixture({
      general: { confirmDelete: false },
    } as never);
    wails().UpdateSettings.mockResolvedValue(saved);
    await renderPanel();
    expect(isToggleOn("Confirm before deleting")).toBe(true);
    await userEvent.click(rowControl("Confirm before deleting"));
    await waitFor(() => expect(isToggleOn("Confirm before deleting")).toBe(false));
  });

  it("flashes a saved confirmation after persisting", async () => {
    await renderPanel();
    await userEvent.click(rowControl("Confirm before deleting"));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });

  it("reports a save failure", async () => {
    wails().UpdateSettings.mockRejectedValue(new Error("nope"));
    await renderPanel();
    await userEvent.click(rowControl("Confirm before deleting"));
    await waitFor(() =>
      expect(screen.getByText(/Failed to save settings/)).toBeInTheDocument(),
    );
  });

  it("reports a load failure and hides the spinner", async () => {
    wails().GetSettings.mockRejectedValue(new Error("nope"));
    render(<SettingsPanel onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Failed to load settings.")).toBeInTheDocument(),
    );
    expect(document.querySelector(".animate-spin")).toBeNull();
  });

  it("still loads when only the version call fails", async () => {
    wails().GetAppVersion.mockRejectedValue(new Error("nope"));
    render(<SettingsPanel onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/Failed to load settings/)).toBeInTheDocument(),
    );
  });

  it("persists a text field edit", async () => {
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Screenshots" }));
    const input = screen.getByDisplayValue("screenshot_{date}");
    fireEvent.change(input, { target: { value: "shot_{date}" } });

    await waitFor(() => {
      const last = wails().UpdateSettings.mock.calls.at(-1)?.[0];
      expect(last.screenshot.filenamePattern).toBe("shot_{date}");
    });
  });

  it("opens the directory picker for the screenshot save location", async () => {
    wails().SelectDirectory.mockResolvedValue("/home/test/Pictures/Other");
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Screenshots" }));
    const picker = screen.getByTitle("Choose screenshot save location");
    await userEvent.click(picker);

    await waitFor(() => expect(wails().SelectDirectory).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        wails().UpdateSettings.mock.calls.at(-1)?.[0].screenshot.saveDir,
      ).toBe("/home/test/Pictures/Other"),
    );
  });

  it("does not persist when the picker is cancelled", async () => {
    wails().SelectDirectory.mockResolvedValue("");
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Screenshots" }));
    await userEvent.click(screen.getByTitle("Choose screenshot save location"));

    await waitFor(() => expect(wails().SelectDirectory).toHaveBeenCalled());
    expect(wails().UpdateSettings).not.toHaveBeenCalled();
  });

  it("reports a failing directory picker", async () => {
    wails().SelectDirectory.mockRejectedValue(new Error("nope"));
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Screenshots" }));
    await userEvent.click(screen.getByTitle("Choose screenshot save location"));

    await waitFor(() =>
      expect(screen.getByText(/Failed to open the directory picker/)).toBeInTheDocument(),
    );
    expect(wails().UpdateSettings).not.toHaveBeenCalled();
  });

  it("resets to the backend defaults", async () => {
    const defaults = appSettingsFixture({
      general: { confirmDelete: true },
      screenshot: { ...appSettingsFixture().screenshot, filenamePattern: "default_{date}" },
    } as never);
    wails().ResetSettings.mockResolvedValue(defaults);
    await renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /Reset to Defaults/ }));
    await waitFor(() => expect(wails().ResetSettings).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Screenshots" }));
    expect(screen.getByDisplayValue("default_{date}")).toBeInTheDocument();
  });

  it("reports a failing reset", async () => {
    wails().ResetSettings.mockRejectedValue(new Error("nope"));
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /Reset to Defaults/ }));
    await waitFor(() =>
      expect(screen.getByText("Failed to reset settings.")).toBeInTheDocument(),
    );
  });

  it("closes through the header button", async () => {
    const { onBack } = await renderPanel();
    await userEvent.click(screen.getByTitle("Close"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("keeps the active category across edits", async () => {
    await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Screenshots" }));
    await userEvent.click(screen.getByTitle("Choose screenshot save location"));
    await waitFor(() => expect(wails().SelectDirectory).toHaveBeenCalled());
    expect(screen.getByText("Filename pattern")).toBeInTheDocument();
  });

  it("sends model instances, not raw objects", async () => {
    await renderPanel();
    await userEvent.click(rowControl("Confirm before deleting"));
    await waitFor(() => expect(wails().UpdateSettings).toHaveBeenCalled());
    const sent = wails().UpdateSettings.mock.calls[0][0];
    expect(sent.constructor.name).toBe("Settings");
    expect(sent.screenshot.constructor.name).toBe("Screenshot");
  });
});