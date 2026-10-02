import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, RotateCcw, Check } from "lucide-react";
import {
  GetSettings,
  UpdateSettings,
  ResetSettings,
  GetAppVersion,
  GetResolutionPresets,
  SelectDirectory,
} from "../../wailsjs/go/main/App";
import { settings } from "../../wailsjs/go/models";
import type {
  AppSettings,
  ResolutionPreset,
  SettingsPanelProps,
} from "@/types/types";
import {
  GeneralSection,
  ScreenshotSection,
  RecordingSection,
  MicrophoneSection,
  EditorSection,
  ShortcutsSection,
  AdvancedSection,
  AboutSection,
} from "./settings/sections";

type Category =
  | "general"
  | "screenshot"
  | "recording"
  | "microphone"
  | "editor"
  | "shortcuts"
  | "advanced"
  | "about";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "general", label: "General" },
  { id: "screenshot", label: "Screenshots" },
  { id: "recording", label: "Recording" },
  { id: "microphone", label: "Microphone" },
  { id: "editor", label: "Editor" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "advanced", label: "Advanced" },
  { id: "about", label: "About" },
];

export type GroupKey =
  | "general"
  | "screenshot"
  | "recording"
  | "editor"
  | "advanced"
  | "customShortcuts";

export default function SettingsPanel({ onBack }: SettingsPanelProps) {
  const [config, setConfig] = useState<AppSettings | null>(null);
  const [version, setVersion] = useState("");
  const [resolutions, setResolutions] = useState<ResolutionPreset[]>([]);
  const [active, setActive] = useState<Category>("general");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let activeFlag = true;
    (async () => {
      try {
        const [cfg, ver, res] = await Promise.all([
          GetSettings(),
          GetAppVersion(),
          GetResolutionPresets(),
        ]);
        if (!activeFlag) return;
        setConfig(cfg);
        setVersion(ver);
        setResolutions(res);
      } catch {
        if (activeFlag) setError("Failed to load settings.");
      } finally {
        if (activeFlag) setLoading(false);
      }
    })();
    return () => {
      activeFlag = false;
    };
  }, []);

  const showSaved = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };

  const persist = async (next: AppSettings) => {
    try {
      const saved = await UpdateSettings(settings.Settings.createFrom(next));
      setConfig(saved);
      setError("");
      showSaved();
    } catch {
      setError("Failed to save settings. Please try again.");
    }
  };

  const updateGroup = (group: GroupKey, patch: Record<string, unknown>) => {
    if (!config) return;
    const plain = JSON.parse(JSON.stringify(config)) as Record<string, any>;
    plain[group] = { ...(plain[group] as Record<string, any>), ...patch };
    const next = settings.Settings.createFrom(plain);
    setConfig(next);
    void persist(next);
  };

  const pickDir = async (group: "screenshot" | "recording", title: string) => {
    try {
      const path = await SelectDirectory(title);
      if (!path) return;
      updateGroup(group, { saveDir: path });
    } catch {
      setError("Failed to open the directory picker.");
    }
  };

  const handleReset = async () => {
    try {
      const defaults = await ResetSettings();
      setConfig(defaults);
      setError("");
      showSaved();
    } catch {
      setError("Failed to reset settings.");
    }
  };

  const renderSection = () => {
    if (!config) return null;
    switch (active) {
      case "general":
        return <GeneralSection config={config} updateGroup={updateGroup} />;
      case "screenshot":
        return (
          <ScreenshotSection
            config={config}
            updateGroup={updateGroup}
            onPickDir={(title) => pickDir("screenshot", title)}
          />
        );
      case "recording":
        return (
          <RecordingSection
            config={config}
            updateGroup={updateGroup}
            onPickDir={(title) => pickDir("recording", title)}
            resolutions={resolutions}
          />
        );
      case "microphone":
        return <MicrophoneSection config={config} updateGroup={updateGroup} />;
      case "editor":
        return <EditorSection config={config} updateGroup={updateGroup} />;
      case "shortcuts":
        return <ShortcutsSection config={config} updateGroup={updateGroup} />;
      case "advanced":
        return <AdvancedSection config={config} updateGroup={updateGroup} />;
      case "about":
        return <AboutSection config={config} version={version} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      key="settings-panel"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="w-[560px] h-[640px] flex flex-col rounded-[10px] backdrop-blur-2xl bg-black shadow-2xl text-white overflow-hidden p-4"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-sm font-medium">Settings</span>
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="flex items-center gap-1 text-[11px] text-green-400">
              <Check size={12} /> Saved
            </span>
          )}
          <button
            onClick={onBack}
            className="p-1.5 rounded-[10px] hover:bg-white/10 text-white/70 transition-colors"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <nav className="w-36 shrink-0 py-2 flex flex-col gap-0.5 border-r border-white/10">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`text-left px-3 py-1.5 rounded-[10px] text-xs transition-colors ${
                active === c.id
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/60 hover:bg-white/5"
              }`}
            >
              {c.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-2 py-3 min-w-0">
          {loading ? (
            <div className="py-12 flex items-center justify-center text-white/50">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            renderSection()
          )}
        </div>
      </div>

      {error && (
        <div className="mx-3 mb-1 px-2 py-1.5 rounded-[10px] bg-red-500/15 border border-red-500/30 text-[11px] text-red-300 break-words">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-2 border-t border-white/10">
        <button
          onClick={handleReset}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs text-white/70 hover:bg-white/10 disabled:opacity-40 transition-colors"
        >
          <RotateCcw size={13} />
          <span>Reset to Defaults</span>
        </button>
        <span className="text-[11px] text-white/40">
          Changes are saved automatically
        </span>
      </div>
    </motion.div>
  );
}
