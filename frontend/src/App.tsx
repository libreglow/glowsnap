import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  EventsOn,
  WindowFullscreen,
  WindowShow,
  LogInfo,
} from "../wailsjs/runtime/runtime";
import {
  ResizeToPalette,
  ResizeToStudio,
  ResizeToRecord,
  ResizeToSettings,
  ResizeToPreferences,
  TakeScreenshot,
  StartPaletteAreaCapture,
  CompletePaletteAreaScreenshot,
  CancelPaletteAreaCapture,
  StartRecording,
  PauseRecording,
  ResumeRecording,
  StopRecording,
  CancelRecording,
  SaveMicrophone,
  SaveRecordingDefaults,
  SetMicEnabled,
  SetSystemEnabled,
  GetSettings,
} from "../wailsjs/go/main/App";
import { AnimatePresence } from "framer-motion";
import Palette from "./components/Palette";
import Studio from "./components/Studio";
import Record from "./components/Record";
import RecordingBar from "./components/RecordingBar";
import RecordingSettings from "./components/RecordingSettings";
import SettingsPanel from "./components/SettingsPanel";
import Overlay from "./components/Overlay";
import { OverlayRect } from "./types/types";
import {
  APP_SHORTCUTS,
  matchesShortcut,
  isEditableTarget,
  applyShortcutOverrides,
} from "./lib/shortcut";
import { WindowMode } from "./types/types";

export default function App() {
  const [mode, setMode] = useState<WindowMode>("palette");
  const [isPaused, setIsPaused] = useState(false);
  const [recStarted, setRecStarted] = useState(false);
  const [recMicEnabled, setRecMicEnabled] = useState(true);
  const [recSystemEnabled, setRecSystemEnabled] = useState(true);
  const [customShortcuts, setCustomShortcuts] = useState<
    Record<string, string>
  >({});
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null);

  const switchToPalette = useCallback(() => {
    setMode("palette");
    ResizeToPalette();
  }, []);

  const switchToStudio = () => {
    setMode("studio");
    ResizeToStudio();
  };

  const switchToRecord = () => {
    setMode("record");
    ResizeToRecord();
  };

  const switchToPreferences = () => {
    setMode("preferences");
    ResizeToPreferences();
  };

  const handleTakeScreenshot = async () => {
    try {
      await TakeScreenshot();
    } catch (err) {
      console.error(err);
    }
  };
  const handleTakeAreaScreenshot = async () => {
    try {
      const url = await StartPaletteAreaCapture();
      setOverlayImageUrl(url);
      setMode("overlay");
      WindowFullscreen();
      WindowShow();
    } catch (err) {
      console.error(err);
      switchToPalette();
    }
  };

  const handleOverlayComplete = useCallback(
    async (rect: OverlayRect) => {
      try {
        await CompletePaletteAreaScreenshot(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
        );
      } catch (err) {
        console.error(err);
      } finally {
        setOverlayImageUrl(null);
        switchToPalette();
      }
    },
    [switchToPalette],
  );

  const handleOverlayCancel = useCallback(async () => {
    try {
      await CancelPaletteAreaCapture();
    } catch (err) {
      console.error(err);
    } finally {
      setOverlayImageUrl(null);
      switchToPalette();
    }
  }, [switchToPalette]);

  const openRecordingSettings = () => {
    setMode("settings");
    ResizeToSettings();
  };

  const handleStartFromSettings = async (
    micOn: boolean,
    systemOn: boolean,
    showMouse: boolean,
    micDevice: string,
  ) => {
    if (micOn && micDevice) {
      await SaveMicrophone(micDevice);
    }
    await SaveRecordingDefaults(micOn, systemOn, showMouse);
    await StartRecording(micOn, systemOn, showMouse, micDevice);
    setRecStarted(false);
    setIsPaused(false);
    setRecMicEnabled(micOn);
    setRecSystemEnabled(systemOn);
    setMode("recording");
    ResizeToPalette();
  };

  const handlePause = async () => {
    await PauseRecording();
    setIsPaused(true);
  };
  const handleResume = async () => {
    await ResumeRecording();
    setIsPaused(false);
  };
  const handleStop = async () => {
    try {
      const path = await StopRecording();
      console.log("Recording saved:", path);
    } catch (err) {
      console.error("StopRecording failed:", err);
    } finally {
      setRecStarted(false);
      setIsPaused(false);
      switchToPalette();
    }
  };
  const handleCancel = async () => {
    try {
      await CancelRecording();
    } catch (err) {
      console.error("CancelRecording failed:", err);
    } finally {
      setRecStarted(false);
      setIsPaused(false);
      switchToPalette();
    }
  };

  const handleToggleMic = (enabled: boolean) => {
    SetMicEnabled(enabled).catch((err) =>
      console.error("SetMicEnabled failed:", err),
    );
  };
  const handleToggleSystem = (enabled: boolean) => {
    SetSystemEnabled(enabled).catch((err) =>
      console.error("SetSystemEnabled failed:", err),
    );
  };

  useEffect(() => {
    let active = true;
    GetSettings()
      .then((cfg) => {
        if (active) setCustomShortcuts(cfg.customShortcuts || {});
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const prevModeRef = useRef<WindowMode>(mode);
  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = mode;
    const changedInSettings = prev === "preferences" || prev === "settings";
    const nowInUse =
      mode === "palette" || mode === "studio" || mode === "recording";
    if (changedInSettings && nowInUse) {
      GetSettings()
        .then((cfg) => setCustomShortcuts(cfg.customShortcuts || {}))
        .catch(() => {});
    }
  }, [mode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === "overlay") {
        if (e.key === "Escape") {
          e.preventDefault();
          handleOverlayCancel();
        }
        return;
      }

      if (isEditableTarget(e.target)) return;
      const shortcuts = applyShortcutOverrides(APP_SHORTCUTS, customShortcuts);
      for (const shortcut of shortcuts) {
        if (matchesShortcut(shortcut, e)) {
          e.preventDefault();
          switch (shortcut.action) {
            case "toggle-palette":
              switchToPalette();
              break;
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [switchToPalette, customShortcuts, mode, handleOverlayCancel]);

  useEffect(() => {
    const unsub = EventsOn("toggle-palette", switchToPalette);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = EventsOn("recording-started", () => {
      setRecStarted(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = EventsOn("recording-ended", () => {
      setRecStarted(false);
      setIsPaused(false);
      switchToPalette();
    });
    return unsub;
  }, []);

  return (
    <div className="w-full wails-drag h-full flex items-center justify-center bg-transparent select-none overflow-hidden">
      <AnimatePresence mode="wait">
        {mode === "palette" && (
          <Palette
            onTakeScreenshot={handleTakeScreenshot}
            onTakeAreaScreenshot={handleTakeAreaScreenshot}
            onSwitchToStudio={switchToStudio}
            onClose={() => setMode("closed")}
            onStartRecording={openRecordingSettings}
            onOpenSettings={switchToPreferences}
            customShortcuts={customShortcuts}
          />
        )}

        {mode === "studio" && (
          <Studio
            onBackToPalette={switchToPalette}
            onSwitchToRecord={switchToRecord}
          />
        )}

        {mode === "record" && (
          <Record
            onBackToPalette={switchToPalette}
            onSwitchToStudio={switchToStudio}
          />
        )}

        {mode === "settings" && (
          <RecordingSettings
            onBack={switchToPalette}
            onStart={handleStartFromSettings}
          />
        )}

        {mode === "preferences" && <SettingsPanel onBack={switchToPalette} />}

        {mode === "recording" && (
          <RecordingBar
            isPaused={isPaused}
            started={recStarted}
            micEnabled={recMicEnabled}
            systemEnabled={recSystemEnabled}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            onCancel={handleCancel}
            onToggleMic={handleToggleMic}
            onToggleSystem={handleToggleSystem}
          />
        )}

        {mode === "overlay" && overlayImageUrl && (
          <Overlay
            imageUrl={overlayImageUrl}
            onComplete={handleOverlayComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
