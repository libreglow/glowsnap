import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type {
  AppSettings,
  ResolutionLimits,
  ResolutionPreset,
  Tool,
} from "@/types/types";
import {
  CUSTOM_RESOLUTION,
  parseDimension,
  validateCustomDimension,
} from "@/lib/resolution";
import {
  SectionHeader,
  SettingRow,
  Toggle,
  Select,
  NumberInput,
  PathPicker,
} from "./primitives";
import { ALL_SHORTCUTS, comboFromEvent } from "@/lib/shortcut";

export type GroupKey =
  | "general"
  | "screenshot"
  | "recording"
  | "editor"
  | "advanced"
  | "customShortcuts";

interface SectionProps {
  config: AppSettings;
  updateGroup: (group: GroupKey, patch: Record<string, unknown>) => void;
}

export function GeneralSection({ config, updateGroup }: SectionProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader
        title="General"
        description="General application behavior."
      />
      <SettingRow
        label="Confirm before deleting"
        description="Ask for confirmation when removing screenshots."
      >
        <Toggle
          checked={config.general.confirmDelete}
          onChange={(v) => updateGroup("general", { confirmDelete: v })}
        />
      </SettingRow>
    </div>
  );
}

interface ScreenshotSectionProps extends SectionProps {
  onPickDir: (title: string) => void;
}

export function ScreenshotSection({
  config,
  updateGroup,
  onPickDir,
}: ScreenshotSectionProps) {
  const sh = config.screenshot;
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader
        title="Screenshots"
        description="Defaults used when capturing."
      />
      <SettingRow
        label="Save location"
        description="Where new screenshots are stored."
      >
        <PathPicker
          value={sh.saveDir}
          title="Choose screenshot save location"
          onPick={() => onPickDir("Choose Screenshot Save Location")}
        />
      </SettingRow>
      <SettingRow
        label="Filename pattern"
        description="Use {date} for a timestamp, e.g. shot_{date}."
      >
        <input
          type="text"
          value={sh.filenamePattern}
          onChange={(e) =>
            updateGroup("screenshot", { filenamePattern: e.target.value })
          }
          className="w-40 bg-white/10 hover:bg-white/15 text-xs text-white/90 rounded-[10px] px-2 py-1.5 border border-white/10 outline-none"
        />
      </SettingRow>
      <SettingRow
        label="Capture delay"
        description="Seconds to wait before capturing (0 = none)."
      >
        <NumberInput
          value={sh.delaySeconds}
          min={0}
          max={60}
          suffix="s"
          onChange={(v) => updateGroup("screenshot", { delaySeconds: v })}
        />
      </SettingRow>
      <SettingRow
        label="Hide panel before screenshot"
        description="Briefly hide the current panel before capturing the screenshot."
      >
        <Toggle
          checked={sh.hidePanelBeforeCapture}
          onChange={(v) =>
            updateGroup("screenshot", { hidePanelBeforeCapture: v })
          }
        />
      </SettingRow>
      <SettingRow
        label="Show mouse cursor"
        description="Include the mouse pointer in screenshots."
      >
        <Toggle
          checked={sh.showMouseByDefault}
          onChange={(v) => updateGroup("screenshot", { showMouseByDefault: v })}
        />
      </SettingRow>
      <SettingRow
        label="Copy to clipboard"
        description="Also copy the capture to the clipboard."
      >
        <Toggle
          checked={sh.copyToClipboard}
          onChange={(v) => updateGroup("screenshot", { copyToClipboard: v })}
        />
      </SettingRow>
      <SettingRow
        label="Open after capture"
        description="Open the saved screenshot in the default viewer."
      >
        <Toggle
          checked={sh.openAfterCapture}
          onChange={(v) => updateGroup("screenshot", { openAfterCapture: v })}
        />
      </SettingRow>
      <SettingRow
        label="Notify on capture"
        description="Show a desktop notification after capturing."
      >
        <Toggle
          checked={sh.notifyOnCapture}
          onChange={(v) => updateGroup("screenshot", { notifyOnCapture: v })}
        />
      </SettingRow>
    </div>
  );
}

interface RecordingSectionProps extends SectionProps {
  onPickDir: (title: string) => void;
  resolutions: ResolutionPreset[];
  customLimits: ResolutionLimits | null;
}

const DIMENSION_INPUT_CLASS =
  "w-20 bg-white/10 hover:bg-white/15 text-xs text-white/90 rounded-[10px] px-2 py-1.5 border border-white/10 outline-none text-right";

export function RecordingSection({
  config,
  updateGroup,
  onPickDir,
  resolutions,
  customLimits,
}: RecordingSectionProps) {
  const rc = config.recording;
  const isCustom = rc.resolution === CUSTOM_RESOLUTION;
  const selected = resolutions.find((r) => r.value === rc.resolution);

  const [customWidth, setCustomWidth] = useState(String(rc.customWidth ?? ""));
  const [customHeight, setCustomHeight] = useState(
    String(rc.customHeight ?? ""),
  );

  useEffect(() => {
    setCustomWidth(String(rc.customWidth ?? ""));
  }, [rc.customWidth]);

  useEffect(() => {
    setCustomHeight(String(rc.customHeight ?? ""));
  }, [rc.customHeight]);

  const customError = isCustom
    ? validateCustomDimension(customWidth, customHeight, customLimits)
    : "";

  const resolutionOptions = [
    ...resolutions.map((r) => ({ value: r.value, label: r.label })),
    { value: CUSTOM_RESOLUTION, label: "Custom" },
  ];

  const persistCustomDimension = (width: string, height: string) => {
    if (validateCustomDimension(width, height, customLimits) !== "") return;
    const w = parseDimension(width);
    const h = parseDimension(height);
    if (w !== null && h !== null) {
      updateGroup("recording", { customWidth: w, customHeight: h });
    }
  };

  const handleCustomWidthChange = (value: string) => {
    setCustomWidth(value);
    persistCustomDimension(value, customHeight);
  };

  const handleCustomHeightChange = (value: string) => {
    setCustomHeight(value);
    persistCustomDimension(customWidth, value);
  };

  const resolutionDescription = isCustom
    ? customError
      ? "Set a custom output size below."
      : `New recordings are scaled to ${customWidth}×${customHeight}.`
    : selected
      ? `New recordings are scaled to ${selected.width}×${selected.height}.`
      : "Output resolution for new recordings.";

  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader
        title="Recording"
        description="Defaults used when recording the screen."
      />
      <SettingRow
        label="Save location"
        description="Where new recordings are stored."
      >
        <PathPicker
          value={rc.saveDir}
          title="Choose recording save location"
          onPick={() => onPickDir("Choose Recording Save Location")}
        />
      </SettingRow>
      <SettingRow label="Resolution" description={resolutionDescription}>
        <Select
          value={rc.resolution}
          options={resolutionOptions}
          onChange={(v) => updateGroup("recording", { resolution: v })}
        />
      </SettingRow>
      {isCustom && (
        <SettingRow
          label="Custom size"
          description={
            customLimits
              ? `Width × height in pixels (even, ${customLimits.minWidth}×${customLimits.minHeight}–${customLimits.maxWidth}×${customLimits.maxHeight}).`
              : "Width × height in pixels (even numbers)."
          }
        >
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              aria-label="Custom width"
              value={customWidth}
              min={customLimits?.minWidth}
              max={customLimits?.maxWidth}
              onChange={(e) => handleCustomWidthChange(e.target.value)}
              className={DIMENSION_INPUT_CLASS}
            />
            <span className="text-white/40 text-xs">×</span>
            <input
              type="number"
              inputMode="numeric"
              aria-label="Custom height"
              value={customHeight}
              min={customLimits?.minHeight}
              max={customLimits?.maxHeight}
              onChange={(e) => handleCustomHeightChange(e.target.value)}
              className={DIMENSION_INPUT_CLASS}
            />
          </div>
        </SettingRow>
      )}
      {isCustom && customError && (
        <div className="px-2 pb-1 text-[11px] text-red-300">{customError}</div>
      )}
      <SettingRow
        label="System audio on by default"
        description="Start new recordings with system audio enabled."
      >
        <Toggle
          checked={rc.systemEnabledByDefault}
          onChange={(v) =>
            updateGroup("recording", { systemEnabledByDefault: v })
          }
        />
      </SettingRow>
      <SettingRow
        label="Show mouse cursor"
        description="Include the mouse pointer in screen recordings."
      >
        <Toggle
          checked={rc.showMouseByDefault}
          onChange={(v) => updateGroup("recording", { showMouseByDefault: v })}
        />
      </SettingRow>
      <SettingRow
        label="Notify when recording ends"
        description="Show a notification when a recording finishes."
      >
        <Toggle
          checked={rc.notifyOnRecordingEnd}
          onChange={(v) =>
            updateGroup("recording", { notifyOnRecordingEnd: v })
          }
        />
      </SettingRow>
    </div>
  );
}

export interface MicrophoneSectionProps extends SectionProps {}

export function MicrophoneSection({
  config,
  updateGroup,
}: MicrophoneSectionProps) {
  const rc = config.recording;
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader
        title="Microphone"
        description="Default microphone for recordings. The device is chosen when starting a recording."
      />
      <SettingRow
        label="Default microphone"
        description="Currently saved default device."
      >
        <span className="text-[11px] text-white/60 font-mono break-all max-w-[200px] text-right">
          {rc.microphone || <i className="opacity-50">none selected</i>}
        </span>
      </SettingRow>
      <SettingRow
        label="Enable microphone by default"
        description="Start new recordings with the microphone enabled."
      >
        <Toggle
          checked={rc.micEnabledByDefault}
          onChange={(v) => updateGroup("recording", { micEnabledByDefault: v })}
        />
      </SettingRow>
    </div>
  );
}

const TOOL_OPTIONS: { value: Tool; label: string }[] = [
  { value: "select", label: "Select" },
  { value: "crop", label: "Crop" },
  { value: "arrow", label: "Arrow" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "pen", label: "Pen" },
  { value: "rectangle", label: "Rectangle" },
  { value: "circle", label: "Circle" },
];

export function EditorSection({ config, updateGroup }: SectionProps) {
  const ed = config.editor;
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader
        title="Editor"
        description="Defaults applied when opening the editor."
      />
      <SettingRow
        label="Default tool"
        description="Tool selected when the editor opens."
      >
        <Select
          value={ed.defaultTool}
          options={TOOL_OPTIONS}
          onChange={(v) => updateGroup("editor", { defaultTool: v })}
        />
      </SettingRow>
      <SettingRow
        label="Default font"
        description="Font family for new text shapes."
      >
        <input
          type="text"
          value={ed.defaultFont}
          onChange={(e) =>
            updateGroup("editor", { defaultFont: e.target.value })
          }
          className="w-32 bg-white/10 hover:bg-white/15 text-xs text-white/90 rounded-[10px] px-2 py-1.5 border border-white/10 outline-none"
        />
      </SettingRow>
      <SettingRow
        label="Default font size"
        description="Size in pixels for new text."
      >
        <NumberInput
          value={ed.defaultFontSize}
          min={4}
          max={120}
          suffix="px"
          onChange={(v) => updateGroup("editor", { defaultFontSize: v })}
        />
      </SettingRow>
      <SettingRow
        label="Default color"
        description="Fill/stroke color for new shapes."
      >
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={ed.defaultColor}
            onChange={(e) =>
              updateGroup("editor", { defaultColor: e.target.value })
            }
            className="w-7 h-5 p-0.5 rounded cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={ed.defaultColor}
            onChange={(e) =>
              updateGroup("editor", { defaultColor: e.target.value })
            }
            className="w-16 bg-white/10 hover:bg-white/15 text-[10px] text-white/80 rounded-[10px] px-2 py-1 border border-white/10 outline-none font-mono"
          />
        </div>
      </SettingRow>
      <SettingRow
        label="Default stroke width"
        description="Stroke width for new shapes."
      >
        <NumberInput
          value={ed.defaultStrokeWidth}
          min={1}
          max={50}
          suffix="px"
          onChange={(v) => updateGroup("editor", { defaultStrokeWidth: v })}
        />
      </SettingRow>
      <SettingRow
        label="Default opacity"
        description="Opacity applied to new shapes."
      >
        <NumberInput
          value={Math.round((ed.defaultOpacity ?? 1) * 100)}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) =>
            updateGroup("editor", {
              defaultOpacity: Math.max(0, Math.min(100, v)) / 100,
            })
          }
        />
      </SettingRow>
    </div>
  );
}

type ShortcutCategory = "editor" | "tool" | "palette" | "app";

const SHORTCUT_CATEGORIES: { id: ShortcutCategory; label: string }[] = [
  { id: "palette", label: "Palette" },
  { id: "tool", label: "Tools" },
  { id: "editor", label: "Editor" },
  { id: "app", label: "Application" },
];

export function ShortcutsSection({ config, updateGroup }: SectionProps) {
  const [recordingId, setRecordingId] = useState<string | null>(null);

  useEffect(() => {
    if (!recordingId) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecordingId(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      updateGroup("customShortcuts", { [recordingId]: combo });
      setRecordingId(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recordingId, updateGroup]);

  const overrides: Record<string, string> = config.customShortcuts || {};

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        title="Shortcuts"
        description="Click a shortcut, then press the new key combination to rebind it. Changes apply and save automatically. Reset restores the default."
      />
      {SHORTCUT_CATEGORIES.map((cat) => {
        const items = ALL_SHORTCUTS.filter((s) => s.category === cat.id);
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className="flex flex-col gap-1">
            <div className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
              {cat.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {items.map((s) => {
                const combo = overrides[s.id] || s.keys;
                const isRecording = recordingId === s.id;
                const isOverridden = !!overrides[s.id];
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded-[10px] hover:bg-white/5"
                  >
                    <span className="text-xs text-white/80 min-w-0 truncate">
                      {s.label}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOverridden && (
                        <button
                          type="button"
                          title="Reset to default"
                          onClick={() =>
                            updateGroup("customShortcuts", { [s.id]: "" })
                          }
                          className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setRecordingId(isRecording ? null : s.id)
                        }
                        className={`text-[11px] font-mono px-2 py-1 rounded min-w-[86px] text-center border transition-colors ${
                          isRecording
                            ? "bg-red-500/20 border-red-400/50 text-red-300 animate-pulse"
                            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {isRecording ? "Press keys…" : combo}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdvancedSection({ config, updateGroup }: SectionProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader
        title="Advanced"
        description="Lower-level toggles for troubleshooting."
      />
      <SettingRow
        label="Verbose logging"
        description="Log extra diagnostic information to the console."
      >
        <Toggle
          checked={config.advanced.verboseLogging}
          onChange={(v) => updateGroup("advanced", { verboseLogging: v })}
        />
      </SettingRow>
    </div>
  );
}

export function AboutSection({
  config,
  version,
}: {
  config: AppSettings;
  version: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="About Glowsnap" />
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
          <img src="/assets/appicon.png" alt="GlowSnap logo" />
        </div>
        <div>
          <div className="text-xs font-medium">Glowsnap</div>
          <div className="text-[11px] text-white/50">
            Version {version || "—"}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-[11px] text-white/60">
        <div className="flex justify-between px-1">
          <span>Save dir (screenshots)</span>
          <span className="font-mono break-all">
            {config.screenshot.saveDir}
          </span>
        </div>
        <div className="flex justify-between px-1">
          <span>Save dir (recordings)</span>
          <span className="font-mono break-all">
            {config.recording.saveDir}
          </span>
        </div>
      </div>
    </div>
  );
}
