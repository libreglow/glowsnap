import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Volume2, X, Loader2, MousePointer2 } from "lucide-react";
import {
  ListMicrophones,
  GetSystemAudioSupported,
  GetVideosDir,
  GetSavedMicrophone,
  GetSettings,
  GetResolutionPresets,
} from "../../wailsjs/go/main/App";
import type {
  AudioDevice,
  ResolutionPreset,
  RecordingSettingsProps,
} from "@/types/types";

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
  disabled,
}: ToggleRowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none text-left transition-colors"
    >
      <span className="text-white/70">{icon}</span>
      <span className="flex-1 text-xs text-white/90">{label}</span>
      <span
        className={`w-8 h-4.5 rounded-full border relative transition-colors ${
          checked
            ? "bg-red-500/80 border-red-400"
            : "bg-white/10 border-white/20"
        }`}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
            checked ? "left-4" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 px-2 py-1.5">
      <span className="text-white/40 text-xs leading-5">{label}</span>
      <span className="flex-1 text-xs text-white/70 leading-5 text-right break-all">
        {value}
      </span>
    </div>
  );
}

export default function RecordingSettings({
  onBack,
  onStart,
}: RecordingSettingsProps) {
  const [mics, setMics] = useState<AudioDevice[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [systemOn, setSystemOn] = useState(true);
  const [showMouse, setShowMouse] = useState(true);
  const [systemSupported, setSystemSupported] = useState(true);
  const [systemMessage, setSystemMessage] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [videosDir, setVideosDir] = useState("");
  const [resolution, setResolution] = useState("");
  const [resolutions, setResolutions] = useState<ResolutionPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [micList, sysInfo, dir, saved, cfg, presets] = await Promise.all([
          ListMicrophones(),
          GetSystemAudioSupported(),
          GetVideosDir(),
          GetSavedMicrophone(),
          GetSettings(),
          GetResolutionPresets(),
        ]);
        if (!active) return;
        setMics(micList);
        setSystemSupported(sysInfo.supported);
        setSystemMessage(sysInfo.message);
        setVideosDir(dir);
        setResolutions(presets);
        setResolution(cfg.recording?.resolution ?? "");
        setMicOn(cfg.recording?.micEnabledByDefault ?? true);
        setSystemOn(cfg.recording?.systemEnabledByDefault ?? true);
        setShowMouse(cfg.recording?.showMouseByDefault ?? true);
        if (saved && micList.some((m) => m.name === saved)) {
          setSelectedMic(saved);
        } else if (micList.length === 1) {
          setSelectedMic(micList[0].name);
        }
      } catch (e) {
        if (active) setError("Failed to load recording settings.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const effectiveSystemOn = systemOn && systemSupported;
  const needsSelection = micOn && mics.length > 1;
  const selectedMicValid = selectedMic !== "";
  const canStart = !starting && (!micOn || !needsSelection || selectedMicValid);
  const resolutionPreset = resolutions.find((r) => r.value === resolution);
  const resolutionLabel = resolutionPreset
    ? `${resolutionPreset.value} (${resolutionPreset.width}×${resolutionPreset.height})`
    : resolution;

  const handleStart = async () => {
    if (!canStart) return;
    setError("");
    setStarting(true);
    try {
      await onStart(micOn, effectiveSystemOn, showMouse, selectedMic);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      className="w-[340px] flex flex-col gap-2 p-4 rounded-2xl backdrop-blur-2xl bg-black/90 shadow-2xl text-white wails-no-drag"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide">
          Recording Settings
        </h2>
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Back"
        >
          <X size={14} />
        </button>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center text-white/50">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-0.5 py-1">
            <ToggleRow
              icon={<Mic size={14} />}
              label="Record Microphone"
              checked={micOn}
              onChange={setMicOn}
            />

            {micOn && (
              <div className="flex flex-col gap-1 pl-8">
                {mics.length === 0 && (
                  <span className="text-[11px] text-white/50 py-1">
                    No microphones found.
                  </span>
                )}
                {mics.length === 1 && (
                  <span className="text-[11px] text-white/50 py-1 truncate">
                    Using: {mics[0].description || mics[0].name}
                  </span>
                )}
                {mics.length > 1 &&
                  mics.map((m) => (
                    <label
                      key={m.name}
                      className="flex items-center gap-2 py-0.5 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="microphone"
                        className="accent-red-500"
                        checked={selectedMic === m.name}
                        onChange={() => setSelectedMic(m.name)}
                      />
                      <span className="text-[11px] text-white/80 truncate">
                        {m.description || m.name}
                      </span>
                    </label>
                  ))}
              </div>
            )}

            <ToggleRow
              icon={<Volume2 size={14} />}
              label="Record System Audio"
              checked={effectiveSystemOn}
              onChange={setSystemOn}
              disabled={!systemSupported}
            />
            {!systemSupported && (
              <span className="text-[11px] text-amber-300/80 pl-8 py-0.5">
                {systemMessage || "System audio is not supported."}
              </span>
            )}

            <ToggleRow
              icon={<MousePointer2 size={14} />}
              label="Show Mouse Cursor"
              checked={showMouse}
              onChange={setShowMouse}
            />
          </div>

          <div className="flex flex-col gap-0.5 py-1 border-t border-white/10">
            <InfoRow label="Save Location" value={videosDir} />
            <InfoRow label="Output Format" value="MP4" />
            <InfoRow label="Resolution" value={resolutionLabel} />
          </div>

          {error && (
            <div className="px-2 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-[11px] text-red-300 break-words">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onBack}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs text-white/70 hover:bg-white/10 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-400 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {starting ? "Starting…" : "Start Recording"}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
