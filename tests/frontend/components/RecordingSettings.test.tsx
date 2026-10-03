import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecordingSettings from "@/components/RecordingSettings";
import {
  appSettingsFixture,
  microphoneEntry,
  wailsModuleMock,
  RESOLUTION_PRESETS,
  type WailsModule,
} from "@tests/test-support/wails";

vi.mock("@wailsjs/go/main/App", async () => {
  const { wailsModuleMock } = await import("@tests/test-support/wails");
  return wailsModuleMock();
});

const App = await import("@wailsjs/go/main/App");
const wails = () => App as unknown as WailsModule;

const MICS = [
  microphoneEntry({ name: "default", description: "Built-in Mic" }),
  microphoneEntry({ name: "usb", description: "USB Headset" }),
];

async function renderPanel(onStart = vi.fn().mockResolvedValue(undefined)) {
  const onBack = vi.fn();
  render(<RecordingSettings onBack={onBack} onStart={onStart} />);
  await waitFor(() =>
    expect(wails().ListMicrophones).toHaveBeenCalledTimes(1),
  );
  await screen.findByRole("button", { name: /Start Recording/ });
  return { onBack, onStart };
}

function toggle(label: string) {
  return screen.getByRole("button", { name: new RegExp(label) });
}

describe("RecordingSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wails().ListMicrophones.mockResolvedValue(MICS);
    wails().GetSystemAudioSupported.mockResolvedValue({
      supported: true,
      message: "",
    });
    wails().GetVideosDir.mockResolvedValue("/home/test/Videos/GlowSnap");
    wails().GetSavedMicrophone.mockResolvedValue("default");
    wails().GetSettings.mockResolvedValue(appSettingsFixture());
    wails().GetResolutionPresets.mockResolvedValue(RESOLUTION_PRESETS);
  });

  it("loads every input in one pass", async () => {
    await renderPanel();
    expect(wails().GetSystemAudioSupported).toHaveBeenCalledTimes(1);
    expect(wails().GetVideosDir).toHaveBeenCalledTimes(1);
    expect(wails().GetSavedMicrophone).toHaveBeenCalledTimes(1);
    expect(wails().GetSettings).toHaveBeenCalledTimes(1);
    expect(wails().GetResolutionPresets).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner until loading finishes", async () => {
    let resolve: (v: unknown) => void = () => {};
    wails().GetVideosDir.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(
      <RecordingSettings onBack={vi.fn()} onStart={vi.fn().mockResolvedValue(undefined)} />,
    );
    expect(document.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Start Recording/ })).not.toBeInTheDocument();

    resolve("/home/test/Videos/GlowSnap");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Start Recording/ })).toBeInTheDocument(),
    );
    expect(document.querySelector(".animate-spin")).toBeNull();
  });

  it("reports a load failure", async () => {
    wails().ListMicrophones.mockRejectedValue(new Error("boom"));
    render(
      <RecordingSettings onBack={vi.fn()} onStart={vi.fn().mockResolvedValue(undefined)} />,
    );
    await waitFor(() =>
      expect(screen.getByText("Failed to load recording settings.")).toBeInTheDocument(),
    );
  });

  it("shows the save location and format", async () => {
    await renderPanel();
    expect(screen.getByText("/home/test/Videos/GlowSnap")).toBeInTheDocument();
    expect(screen.getByText("MP4")).toBeInTheDocument();
  });

  it("describes the configured resolution preset", async () => {
    await renderPanel();
    expect(screen.getByText("1080p (1920×1080)")).toBeInTheDocument();
  });

  it("describes a custom resolution", async () => {
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({
        recording: {
          saveDir: "/home/test/Videos/GlowSnap",
          microphone: "",
          micEnabledByDefault: true,
          systemEnabledByDefault: true,
          showMouseByDefault: true,
          resolution: "custom",
          customWidth: 1280,
          customHeight: 720,
          notifyOnRecordingEnd: false,
        },
      } as never),
    );
    await renderPanel();
    expect(screen.getByText("Custom (1280×720)")).toBeInTheDocument();
  });

  it("falls back to the raw resolution key for an unknown preset", async () => {
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({
        recording: {
          ...appSettingsFixture().recording,
          resolution: "4320p",
        },
      } as never),
    );
    await renderPanel();
    expect(screen.getByText("4320p")).toBeInTheDocument();
  });

  it("offers a radio per microphone when there is more than one", async () => {
    await renderPanel();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText("Built-in Mic")).toBeInTheDocument();
  });

  it("preselects the saved microphone when it still exists", async () => {
    await renderPanel();
    expect(screen.getByRole("radio", { name: /USB Headset/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Built-in Mic/ })).toBeChecked();
  });

  it("reports the chosen microphone to onStart", async () => {
    const { onStart } = await renderPanel();
    await userEvent.click(screen.getByRole("radio", { name: /USB Headset/ }));
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(onStart.mock.calls[0][3]).toBe("usb");
  });

  it("auto-selects the only microphone", async () => {
    wails().ListMicrophones.mockResolvedValue([MICS[0]]);
    const { onStart } = await renderPanel();
    expect(screen.getByText(/Using: Built-in Mic/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(onStart.mock.calls[0][3]).toBe("default");
  });

  it("shows a message when no microphone exists", async () => {
    wails().ListMicrophones.mockResolvedValue([]);
    await renderPanel();
    expect(screen.getByText("No microphones found.")).toBeInTheDocument();
  });

  it("hides the microphone list when recording is off", async () => {
    await renderPanel();
    await userEvent.click(toggle("Record Microphone"));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("still starts without a microphone when recording is off", async () => {
    const { onStart } = await renderPanel();
    await userEvent.click(toggle("Record Microphone"));
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(onStart.mock.calls[0][0]).toBe(false);
  });

  it("passes the audio and cursor choices to onStart", async () => {
    const { onStart } = await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(onStart.mock.calls[0].slice(0, 3)).toEqual([true, true, true]);
  });

  it("passes a toggled system audio state", async () => {
    const { onStart } = await renderPanel();
    await userEvent.click(toggle("Record System Audio"));
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(onStart.mock.calls[0][1]).toBe(false);
  });

  it("passes a hidden cursor", async () => {
    const { onStart } = await renderPanel();
    await userEvent.click(toggle("Show Mouse Cursor"));
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(onStart.mock.calls[0][2]).toBe(false);
  });

  it("disables system audio when the backend reports it unsupported", async () => {
    wails().GetSystemAudioSupported.mockResolvedValue({
      supported: false,
      message: "PulseAudio is not running",
    });
    const { onStart } = await renderPanel();
    expect(screen.getByText("PulseAudio is not running")).toBeInTheDocument();
    expect(toggle("Record System Audio")).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(onStart.mock.calls[0][1]).toBe(false);
  });

  it("shows a default message when unsupported without a reason", async () => {
    wails().GetSystemAudioSupported.mockResolvedValue({
      supported: false,
      message: "",
    });
    await renderPanel();
    expect(screen.getByText("System audio is not supported.")).toBeInTheDocument();
  });

  it("requires a microphone choice when several exist", async () => {
    wails().GetSavedMicrophone.mockResolvedValue("");
    await renderPanel();
    const start = screen.getByRole("button", { name: /Start Recording/ });
    expect(start).toBeDisabled();
    expect(screen.getAllByRole("radio")[0]).not.toBeChecked();
  });

  it("unlocks the start button once a microphone is chosen", async () => {
    wails().GetSavedMicrophone.mockResolvedValue("");
    await renderPanel();
    await userEvent.click(screen.getAllByRole("radio")[0]);
    expect(screen.getByRole("button", { name: /Start Recording/ })).toBeEnabled();
  });

  it("ignores a saved microphone that no longer exists", async () => {
    wails().GetSavedMicrophone.mockResolvedValue("gone");
    const { onStart } = await renderPanel();
    expect(screen.getAllByRole("radio").every((r) => !(r as HTMLInputElement).checked)).toBe(
      true,
    );
    await userEvent.click(screen.getAllByRole("radio")[1]);
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(onStart.mock.calls[0][3]).toBe("usb");
  });

  it("shows a Starting state while the recording starts", async () => {
    let release: () => void = () => {};
    const onStart = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await renderPanel(onStart);
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Starting/ })).toBeDisabled(),
    );
    release();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Start Recording/ })).toBeEnabled(),
    );
  });

  it("surfaces an error from onStart", async () => {
    const onStart = vi.fn().mockRejectedValue(new Error("portal refused"));
    await renderPanel(onStart);
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() =>
      expect(screen.getByText("portal refused")).toBeInTheDocument(),
    );
  });

  it("stringifies a non-Error rejection", async () => {
    const onStart = vi.fn().mockRejectedValue("boom");
    await renderPanel(onStart);
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });

  it("clears a previous error on the next attempt", async () => {
    const onStart = vi
      .fn()
      .mockRejectedValueOnce(new Error("portal refused"))
      .mockResolvedValueOnce(undefined);
    await renderPanel(onStart);
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(screen.getByText("portal refused")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() =>
      expect(screen.queryByText("portal refused")).not.toBeInTheDocument(),
    );
  });

  it("goes back through both back controls", async () => {
    const { onBack } = await renderPanel();
    const backButtons = screen.getAllByRole("button", { name: "Back" });
    expect(backButtons).toHaveLength(2);
    await userEvent.click(backButtons[0]);
    expect(onBack).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getAllByRole("button", { name: "Back" })[1]);
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it("reflects the audio defaults from the settings file", async () => {
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({
        recording: {
          ...appSettingsFixture().recording,
          micEnabledByDefault: false,
          systemEnabledByDefault: false,
          showMouseByDefault: false,
        },
      } as never),
    );
    const { onStart } = await renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /Start Recording/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(onStart.mock.calls[0].slice(0, 3)).toEqual([false, false, false]);
  });
});