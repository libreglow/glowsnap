import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import App from "@/App";
import {
  appSettingsFixture,
  captureEventHandlers,
  runtimeModuleMock,
  wailsModuleMock,
  type WailsModule,
} from "@tests/test-support/wails";

vi.mock("@wailsjs/go/main/App", async () => {
  const { wailsModuleMock } = await import("@tests/test-support/wails");
  return wailsModuleMock();
});

vi.mock("@wailsjs/runtime/runtime", async () => {
  const { runtimeModuleMock } = await import("@tests/test-support/wails");
  return runtimeModuleMock();
});

type ProbeProps = Record<string, (...args: never[]) => void>;

vi.mock("@/components/Palette", () => ({
  default: (props: ProbeProps & { customShortcuts: Record<string, string> }) => (
    <div data-testid="palette">
      <span data-testid="palette-shortcuts">
        {JSON.stringify(props.customShortcuts)}
      </span>
      <button onClick={() => props.onTakeScreenshot()}>shot</button>
      <button onClick={() => props.onTakeAreaScreenshot()}>area</button>
      <button onClick={() => props.onSwitchToStudio()}>studio</button>
      <button onClick={() => props.onStartRecording()}>record</button>
      <button onClick={() => props.onOpenSettings()}>prefs</button>
      <button onClick={() => props.onClose()}>close</button>
    </div>
  ),
}));

vi.mock("@/components/Studio", () => ({
  default: (props: ProbeProps) => (
    <div data-testid="studio">
      <button onClick={() => props.onBackToPalette()}>back</button>
      <button onClick={() => props.onSwitchToRecord()}>record</button>
    </div>
  ),
}));

vi.mock("@/components/Record", () => ({
  default: (props: ProbeProps) => (
    <div data-testid="record">
      <button onClick={() => props.onBackToPalette()}>back</button>
      <button onClick={() => props.onSwitchToStudio()}>studio</button>
    </div>
  ),
}));

vi.mock("@/components/RecordingSettings", () => ({
  default: (props: {
    onBack: () => void;
    onStart: (
      micOn: boolean,
      systemOn: boolean,
      showMouse: boolean,
      micDevice: string,
    ) => void;
  }) => (
    <div data-testid="recording-settings">
      <button onClick={props.onBack}>back</button>
      <button
        onClick={() => props.onStart(true, false, true, "default-source")}
      >
        start
      </button>
      <button onClick={() => props.onStart(false, false, false, "")}>bare</button>
    </div>
  ),
}));

vi.mock("@/components/SettingsPanel", () => ({
  default: (props: ProbeProps) => (
    <div data-testid="settings-panel">
      <button onClick={() => props.onBack()}>back</button>
    </div>
  ),
}));

vi.mock("@/components/RecordingBar", () => ({
  default: (props: ProbeProps & { started: boolean; isPaused: boolean }) => (
    <div data-testid="recording-bar">
      <span data-testid="recording-state">
        {`${props.started ? "started" : "idle"}-${props.isPaused ? "paused" : "live"}`}
      </span>
      <button onClick={() => props.onPause()}>pause</button>
      <button onClick={() => props.onResume()}>resume</button>
      <button onClick={() => props.onStop()}>stop</button>
      <button onClick={() => props.onCancel()}>cancel</button>
      <button onClick={() => props.onToggleMic(false)}>mic</button>
      <button onClick={() => props.onToggleSystem(false)}>system</button>
    </div>
  ),
}));

vi.mock("@/components/Overlay", () => ({
  default: (props: {
    imageUrl: string;
    onComplete: (rect: { x: number; y: number; width: number; height: number }) => void;
  }) => (
    <div data-testid="overlay">
      <span data-testid="overlay-url">{props.imageUrl}</span>
      <button
        onClick={() => props.onComplete({ x: 10, y: 20, width: 300, height: 200 })}
      >
        crop
      </button>
    </div>
  ),
}));

const Bindings = await import("@wailsjs/go/main/App");
const Runtime = await import("@wailsjs/runtime/runtime");

const bindings = () => Bindings as unknown as WailsModule;
const runtime = () => Runtime as unknown as WailsModule;

let events: Map<string, (payload?: unknown) => void>;

function setup(settings = appSettingsFixture()) {
  events = captureEventHandlers(runtimeModuleMock());
  runtime().EventsOn.mockImplementation(
    (event: string, handler: (payload?: unknown) => void) => {
      events.set(event, handler);
      return () => events.delete(event);
    },
  );
  bindings().GetSettings.mockResolvedValue(settings);
  const view = render(<App />);
  return { view };
}

function click(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

async function renderApp(settings = appSettingsFixture()) {
  const { view } = setup(settings);
  await waitFor(() => expect(bindings().GetSettings).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByTestId("palette")).toBeInTheDocument());
  return view;
}

async function enterOverlay() {
  await renderApp();
  bindings().StartPaletteAreaCapture.mockResolvedValue("http://127.0.0.1:34115/a.png");
  click("area");
  await waitFor(() => expect(screen.getByTestId("overlay")).toBeInTheDocument());
}

async function enterRecording() {
  await renderApp();
  click("record");
  await waitFor(() =>
    expect(screen.getByTestId("recording-settings")).toBeInTheDocument(),
  );
}

describe("App", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    events.clear();
  });

  it("starts in the palette and loads custom shortcuts", async () => {
    await renderApp(
      appSettingsFixture({ customShortcuts: { "app-toggle-palette": "Ctrl+Alt+P" } }),
    );
    expect(screen.getByTestId("palette")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("palette-shortcuts")).toHaveTextContent(
        '{"app-toggle-palette":"Ctrl+Alt+P"}',
      ),
    );
  });

  it("ignores settings load failures", async () => {
    bindings().GetSettings.mockRejectedValue(new Error("boom"));
    await renderApp();
    expect(screen.getByTestId("palette-shortcuts")).toHaveTextContent("{}");
  });

  it("captures a full screenshot", async () => {
    await renderApp();
    click("shot");
    await waitFor(() => expect(bindings().TakeScreenshot).toHaveBeenCalled());
  });

  it("logs and recovers when a full screenshot fails", async () => {
    await renderApp();
    bindings().TakeScreenshot.mockRejectedValue(new Error("nope"));
    click("shot");
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.getByTestId("palette")).toBeInTheDocument();
  });

  it("opens the area-capture overlay fullscreen with the captured image", async () => {
    await enterOverlay();
    expect(screen.getByTestId("overlay-url")).toHaveTextContent(
      "http://127.0.0.1:34115/a.png",
    );
    expect(runtime().WindowFullscreen).toHaveBeenCalled();
    expect(runtime().WindowShow).toHaveBeenCalled();
  });

  it("completes an area capture and returns to the palette", async () => {
    await enterOverlay();
    click("crop");
    await waitFor(() =>
      expect(bindings().CompletePaletteAreaScreenshot).toHaveBeenCalledWith(
        10,
        20,
        300,
        200,
      ),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("overlay")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("palette")).toBeInTheDocument();
    expect(bindings().ResizeToPalette).toHaveBeenCalled();
  });

  it("keeps the palette when completing an area capture fails", async () => {
    await enterOverlay();
    bindings().CompletePaletteAreaScreenshot.mockRejectedValue(new Error("nope"));
    click("crop");
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.getByTestId("palette")).toBeInTheDocument();
  });

  it("returns to the palette when the area capture cannot start", async () => {
    await renderApp();
    bindings().StartPaletteAreaCapture.mockRejectedValue(new Error("denied"));
    click("area");
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.getByTestId("palette")).toBeInTheDocument();
    expect(runtime().WindowFullscreen).not.toHaveBeenCalled();
  });

  it("cancels an area capture with Escape", async () => {
    await enterOverlay();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(bindings().CancelPaletteAreaCapture).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId("overlay")).not.toBeInTheDocument(),
    );
  });

  it("keeps the palette when cancelling an area capture fails", async () => {
    await enterOverlay();
    bindings().CancelPaletteAreaCapture.mockRejectedValue(new Error("nope"));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.getByTestId("palette")).toBeInTheDocument();
  });

  it("switches to the studio and resizes", async () => {
    await renderApp();
    click("studio");
    expect(screen.getByTestId("studio")).toBeInTheDocument();
    expect(bindings().ResizeToStudio).toHaveBeenCalled();
  });

  it("navigates studio -> record -> studio -> palette", async () => {
    await renderApp();
    click("studio");
    click("record");
    expect(screen.getByTestId("record")).toBeInTheDocument();
    expect(bindings().ResizeToRecord).toHaveBeenCalled();

    click("studio");
    expect(screen.getByTestId("studio")).toBeInTheDocument();
    click("back");
    expect(screen.getByTestId("palette")).toBeInTheDocument();
    expect(bindings().ResizeToPalette).toHaveBeenCalled();
  });

  it("renders nothing after closing from the palette", async () => {
    await renderApp();
    click("close");
    await waitFor(() => expect(screen.queryByTestId("palette")).not.toBeInTheDocument());
    expect(runtime().EventsOn).toHaveBeenCalledWith(
      "toggle-palette",
      expect.any(Function),
    );
  });

  it("opens recording settings and resizes to the settings window", async () => {
    await renderApp();
    click("record");
    expect(screen.getByTestId("recording-settings")).toBeInTheDocument();
    expect(bindings().ResizeToSettings).toHaveBeenCalled();
  });

  it("opens preferences and returns to the palette", async () => {
    await renderApp();
    click("prefs");
    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(bindings().ResizeToPreferences).toHaveBeenCalled();
    click("back");
    expect(screen.getByTestId("palette")).toBeInTheDocument();
  });

  it("starts a recording with the microphone and defaults saved first", async () => {
    await enterRecording();
    click("start");
    await waitFor(() => expect(bindings().SaveMicrophone).toHaveBeenCalledWith("default-source"));
    expect(bindings().SaveRecordingDefaults).toHaveBeenCalledWith(true, false, true);
    expect(bindings().StartRecording).toHaveBeenCalledWith(
      true,
      false,
      true,
      "default-source",
    );
    await waitFor(() =>
      expect(screen.getByTestId("recording-bar")).toBeInTheDocument(),
    );
    expect(bindings().ResizeToPalette).toHaveBeenCalled();
  });

  it("skips the microphone save when no device is chosen", async () => {
    await enterRecording();
    click("bare");
    await waitFor(() => expect(bindings().SaveRecordingDefaults).toHaveBeenCalled());
    expect(bindings().SaveMicrophone).not.toHaveBeenCalled();
    expect(bindings().StartRecording).toHaveBeenCalledWith(false, false, false, "");
  });

  it("pauses, resumes, and stops a recording", async () => {
    await enterRecording();
    click("start");
    await waitFor(() => expect(screen.getByTestId("recording-bar")).toBeInTheDocument());

    events.get("recording-started")?.();
    await waitFor(() =>
      expect(screen.getByTestId("recording-state")).toHaveTextContent("started-live"),
    );

    click("pause");
    await waitFor(() => expect(bindings().PauseRecording).toHaveBeenCalled());
    expect(screen.getByTestId("recording-state")).toHaveTextContent("started-paused");

    click("resume");
    await waitFor(() => expect(bindings().ResumeRecording).toHaveBeenCalled());
    expect(screen.getByTestId("recording-state")).toHaveTextContent("started-live");

    bindings().StopRecording.mockResolvedValue("/home/test/videos/out.mp4");
    click("stop");
    await waitFor(() =>
      expect(bindings().StopRecording).toHaveBeenCalled(),
    );
    await waitFor(() => expect(screen.getByTestId("palette")).toBeInTheDocument());
    expect(console.log).toHaveBeenCalledWith(
      "Recording saved:",
      "/home/test/videos/out.mp4",
    );
  });

  it("returns to the palette when stopping fails", async () => {
    await enterRecording();
    click("start");
    await waitFor(() => expect(screen.getByTestId("recording-bar")).toBeInTheDocument());
    bindings().StopRecording.mockRejectedValue(new Error("nope"));
    click("stop");
    await waitFor(() => expect(console.error).toHaveBeenCalledWith(
      "StopRecording failed:",
      expect.any(Error),
    ));
    expect(screen.getByTestId("palette")).toBeInTheDocument();
  });

  it("cancels a recording back to the palette", async () => {
    await enterRecording();
    click("start");
    await waitFor(() => expect(screen.getByTestId("recording-bar")).toBeInTheDocument());
    click("cancel");
    await waitFor(() => expect(bindings().CancelRecording).toHaveBeenCalled());
    expect(screen.getByTestId("palette")).toBeInTheDocument();
  });

  it("returns to the palette when cancelling a recording fails", async () => {
    await enterRecording();
    click("start");
    await waitFor(() => expect(screen.getByTestId("recording-bar")).toBeInTheDocument());
    bindings().CancelRecording.mockRejectedValue(new Error("nope"));
    click("cancel");
    await waitFor(() => expect(console.error).toHaveBeenCalledWith(
      "CancelRecording failed:",
      expect.any(Error),
    ));
    expect(screen.getByTestId("palette")).toBeInTheDocument();
  });

  it("toggles microphone and system audio", async () => {
    await enterRecording();
    click("start");
    await waitFor(() => expect(screen.getByTestId("recording-bar")).toBeInTheDocument());
    click("mic");
    await waitFor(() => expect(bindings().SetMicEnabled).toHaveBeenCalledWith(false));
    click("system");
    await waitFor(() =>
      expect(bindings().SetSystemEnabled).toHaveBeenCalledWith(false),
    );
  });

  it("logs toggle failures", async () => {
    await enterRecording();
    click("start");
    await waitFor(() => expect(screen.getByTestId("recording-bar")).toBeInTheDocument());
    bindings().SetMicEnabled.mockRejectedValue(new Error("nope"));
    bindings().SetSystemEnabled.mockRejectedValue(new Error("nope"));
    click("mic");
    click("system");
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "SetMicEnabled failed:",
        expect.any(Error),
      );
      expect(console.error).toHaveBeenCalledWith(
        "SetSystemEnabled failed:",
        expect.any(Error),
      );
    });
  });

  it("returns to the palette on the toggle-palette backend event", async () => {
    await renderApp();
    click("studio");
    events.get("toggle-palette")?.();
    await waitFor(() => expect(screen.getByTestId("palette")).toBeInTheDocument());
    expect(bindings().ResizeToPalette).toHaveBeenCalled();
  });

  it("returns to the palette when recording ends", async () => {
    await enterRecording();
    click("start");
    await waitFor(() => expect(screen.getByTestId("recording-bar")).toBeInTheDocument());
    events.get("recording-started")?.();
    await waitFor(() =>
      expect(screen.getByTestId("recording-state")).toHaveTextContent("started-live"),
    );
    click("pause");
    await waitFor(() =>
      expect(screen.getByTestId("recording-state")).toHaveTextContent("started-paused"),
    );
    events.get("recording-ended")?.();
    await waitFor(() => expect(screen.getByTestId("palette")).toBeInTheDocument());
  });

  it("unsubscribes backend event handlers on unmount", async () => {
    const view = await renderApp();
    expect(events.has("toggle-palette")).toBe(true);
    expect(events.has("recording-started")).toBe(true);
    expect(events.has("recording-ended")).toBe(true);
    view.unmount();
    expect(events.size).toBe(0);
  });

  it("supports the default and custom palette shortcuts", async () => {
    await renderApp();
    click("studio");

    fireEvent.keyDown(window, { key: "s", ctrlKey: true, altKey: true });
    await waitFor(() => expect(screen.getByTestId("palette")).toBeInTheDocument());

    bindings().GetSettings.mockResolvedValue(
      appSettingsFixture({ customShortcuts: { "app-toggle-palette": "Ctrl+Alt+P" } }),
    );
    click("prefs");
    await waitFor(() =>
      expect(screen.getByTestId("settings-panel")).toBeInTheDocument(),
    );
    click("back");
    await waitFor(() =>
      expect(screen.getByTestId("palette-shortcuts")).toHaveTextContent(
        "Ctrl+Alt+P",
      ),
    );

    click("studio");
    fireEvent.keyDown(window, { key: "s", ctrlKey: true, altKey: true });
    expect(screen.getByTestId("studio")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "p", ctrlKey: true, altKey: true });
    await waitFor(() => expect(screen.getByTestId("palette")).toBeInTheDocument());
  });

  it("ignores shortcuts typed in editable fields", async () => {
    await renderApp();
    click("studio");
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: "s", ctrlKey: true, altKey: true });
    expect(screen.getByTestId("studio")).toBeInTheDocument();
    input.remove();
  });

  it("ignores non-overlay shortcuts other than the palette toggle", async () => {
    await renderApp();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(bindings().CancelPaletteAreaCapture).not.toHaveBeenCalled();
    expect(screen.getByTestId("palette")).toBeInTheDocument();
  });

  it("prevents the default action for a handled shortcut", async () => {
    await renderApp();
    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      altKey: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});