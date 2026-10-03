import { vi } from "vitest";
import type { AppSettings, ShapeConfig } from "@/types/types";

/**
 * Every binding used by the React tree, so a component test can mock the whole
 * generated module with a single call and then override just what it needs.
 */
export const WAILS_BINDINGS = [
  "ResizeToPalette",
  "ResizeToStudio",
  "ResizeToRecord",
  "ResizeToSettings",
  "ResizeToPreferences",
  "TakeScreenshot",
  "StartPaletteAreaCapture",
  "CompletePaletteAreaScreenshot",
  "CancelPaletteAreaCapture",
  "StartRecording",
  "PauseRecording",
  "ResumeRecording",
  "StopRecording",
  "CancelRecording",
  "SaveMicrophone",
  "SaveRecordingDefaults",
  "SetMicEnabled",
  "SetSystemEnabled",
  "GetSettings",
  "UpdateSettings",
  "ResetSettings",
  "GetAppVersion",
  "GetResolutionPresets",
  "GetCustomResolutionLimits",
  "SelectDirectory",
  "SelectSaveFile",
  "SaveFileDialog",
  "WriteFile",
  "ReadFile",
  "DeleteFile",
  "GetScreenshotsBaseURL",
  "GetRecordingsBaseURL",
  "GetVideosDir",
  "ListScreenshots",
  "RenameScreenshot",
  "DeleteScreenshot",
  "ListRecordings",
  "DeleteRecording",
  "ListMicrophones",
  "GetSavedMicrophone",
  "GetSystemAudioSupported",
  "OpenToolsPalette",
  "OnSecondInstance",
] as const;

export const WAILS_EVENT_HELPERS = [
  "EventsOn",
  "EventsEmit",
  "EventsOff",
  "EventsOnce",
  "WindowShow",
  "WindowHide",
  "WindowFullscreen",
  "WindowSetTitle",
  "LogInfo",
  "LogError",
] as const;

export type WailsModule = Record<string, ReturnType<typeof vi.fn>>;

/** A module of vi.fn() bindings, each resolving to undefined. */
export function wailsModuleMock(): WailsModule {
  const mod: WailsModule = {};
  for (const name of WAILS_BINDINGS) mod[name] = vi.fn().mockResolvedValue(undefined);
  for (const name of WAILS_EVENT_HELPERS) mod[name] = vi.fn();
  return mod;
}

export function runtimeModuleMock(): WailsModule {
  const mod: WailsModule = {};
  for (const name of WAILS_EVENT_HELPERS) mod[name] = vi.fn();
  return mod;
}

/** Registers EventsOn handlers so tests can fire backend events. */
export function captureEventHandlers(mod: WailsModule): Map<string, (payload?: unknown) => void> {
  const handlers = new Map<string, (payload?: unknown) => void>();
  mod.EventsOn = vi.fn((event: string, handler: (payload?: unknown) => void) => {
    handlers.set(event, handler);
    return () => handlers.delete(event);
  }) as unknown as WailsModule["EventsOn"];
  return handlers;
}

export const BASE_URL = "http://127.0.0.1:34115";

export function screenshotEntry(overrides: Record<string, unknown> = {}) {
  const name = (overrides.name as string) ?? "Screenshot_2024-01-01_10-00-00.png";
  return {
    name,
    path: `/home/test/Pictures/GlowSnap/${name}`,
    size: 2048,
    createdAt: 1_704_096_000,
    modifiedAt: 1_704_096_000,
    date: 1_704_096_000,
    dateSource: "birth",
    ...overrides,
  };
}

export function recordingEntry(overrides: Record<string, unknown> = {}) {
  const name = (overrides.name as string) ?? "Recording_2024-01-01_10-00-00.mp4";
  return {
    name,
    path: `/home/test/Videos/GlowSnap/${name}`,
    thumbnailName: "",
    thumbnailReady: false,
    ...overrides,
  };
}

export function shapeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "shape-1",
    type: "rect",
    x: 40,
    y: 60,
    width: 120,
    height: 80,
    fill: "#ff3b30",
    stroke: "#ff3b30",
    strokeWidth: 3,
    opacity: 1,
    rotation: 0,
    fillEnabled: false,
    ...overrides,
  } as unknown as ShapeConfig;
}

export function microphoneEntry(overrides: Record<string, unknown> = {}) {
  return {
    name: "default-source",
    description: "alsa_input.usb",
    ...overrides,
  };
}

/**
 * A complete AppSettings payload matching services/settings.Settings, including
 * the JSON keys the Go backend sends over the Wails bridge.
 */
export function appSettingsFixture(overrides: Record<string, unknown> = {}): AppSettings {
  return {
    general: { confirmDelete: true },
    screenshot: {
      saveDir: "/home/test/Pictures/GlowSnap",
      filenamePattern: "screenshot_{date}",
      delaySeconds: 0,
      copyToClipboard: false,
      openAfterCapture: false,
      notifyOnCapture: false,
      hidePanelBeforeCapture: true,
      showMouseByDefault: true,
    },
    recording: {
      saveDir: "/home/test/Videos/GlowSnap",
      microphone: "",
      micEnabledByDefault: true,
      systemEnabledByDefault: true,
      showMouseByDefault: true,
      resolution: "1080p",
      customWidth: 1920,
      customHeight: 1080,
      notifyOnRecordingEnd: false,
    },
    editor: {
      defaultTool: "select",
      defaultFont: "Inter",
      defaultFontSize: 24,
      defaultColor: "#ff3b30",
      defaultStrokeWidth: 3,
      defaultOpacity: 1,
    },
    advanced: { verboseLogging: false },
    shortcuts: {
      takeScreenshot: "Ctrl+Shift+S",
      startRecording: "Ctrl+Shift+R",
      stopRecording: "Ctrl+Shift+X",
      openPalette: "Ctrl+Space",
      openEditor: "Ctrl+Alt+E",
      cancel: "",
    },
    customShortcuts: {},
    favorites: { recordings: [], screenshots: [] },
    ...overrides,
  } as unknown as AppSettings;
}

export const RESOLUTION_PRESETS = [
  { value: "360p", label: "360p", width: 640, height: 360 },
  { value: "480p", label: "480p", width: 854, height: 480 },
  { value: "720p", label: "720p", width: 1280, height: 720 },
  { value: "1080p", label: "1080p", width: 1920, height: 1080 },
  { value: "1440p", label: "1440p", width: 2560, height: 1440 },
  { value: "2160p", label: "2160p", width: 3840, height: 2160 },
];

export const CUSTOM_RESOLUTION_LIMITS = {
  minWidth: 16,
  minHeight: 16,
  maxWidth: 3840,
  maxHeight: 2160,
};
