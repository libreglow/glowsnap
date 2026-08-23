import Konva from "konva";
import type { main, screencast, settings } from "../../wailsjs/go/models";

export type Screenshot = main.ScreenshotInfo;
export type AudioDevice = screencast.AudioDevice;
export type AppSettings = settings.Settings;

export interface PaletteProps {
  onTakeScreenshot: () => void;
  onTakeAreaScreenshot: () => void;
  onSwitchToStudio: () => void;
  onClose: () => void;
}

export interface StudioProps {
  onBackToPalette: () => void;
  onSwitchToRecord: () => void;
}

export interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

export type WindowMode =
  | "palette"
  | "studio"
  | "record"
  | "closed"
  | "recording"
  | "settings"
  | "preferences"
  | "overlay";

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayProps {
  imageUrl: string;
  onComplete: (rect: OverlayRect) => void;
}

export interface SettingsPanelProps {
  onBack: () => void;
}

export interface RecordProps {
  onBackToPalette: () => void;
  onSwitchToStudio: () => void;
}

export type Recording = main.RecordingInfo;

export interface RecordingBarProps {
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  isPaused: boolean;
  started: boolean;
  micEnabled: boolean;
  systemEnabled: boolean;
  onToggleMic: (enabled: boolean) => void;
  onToggleSystem: (enabled: boolean) => void;
}

export interface RecordingSettingsProps {
  onBack: () => void;
  onStart: (
    micOn: boolean,
    systemOn: boolean,
    showMouse: boolean,
    micDevice: string,
  ) => Promise<void>;
}

export type Tool =
  | "select"
  | "crop"
  | "arrow"
  | "text"
  | "number"
  | "pen"
  | "rectangle"
  | "circle"
  | "eraser";

export interface ShapeConfig {
  id: string;
  type: "rect" | "circle" | "arrow" | "text" | "number" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  text?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  direction?: "ltr" | "rtl";
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: string;
  rotation?: number;
  fillEnabled?: boolean;
  eraseStrokes?: { points: number[]; strokeWidth: number }[];
}

export interface EditorProps {
  imageUrl: string;
  onBack: () => void;
}
