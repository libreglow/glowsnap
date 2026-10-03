import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import RecordingBar from "@/components/RecordingBar";
import type { RecordingBarProps } from "@/types/types";

function setup(props: Partial<RecordingBarProps> = {}) {
  const handlers = {
    onStop: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onCancel: vi.fn(),
    onToggleMic: vi.fn(),
    onToggleSystem: vi.fn(),
  };
  const view = render(
    <RecordingBar
      isPaused={false}
      started
      micEnabled
      systemEnabled
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, rerender: view.rerender };
}

async function tick(times = 1) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe("RecordingBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the timer at 00:00", () => {
    setup();
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("counts seconds up while running", async () => {
    setup();
    await tick(3);
    expect(screen.getByText("00:03")).toBeInTheDocument();
  });

  it("formats minutes and seconds", async () => {
    setup();
    await act(async () => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("formats durations beyond an hour", async () => {
    setup();
    await act(async () => {
      vi.advanceTimersByTime(3_723_000);
    });
    expect(screen.getByText("62:03")).toBeInTheDocument();
  });

  it("keeps counting after a pause is toggled and resumed", async () => {
    const h = setup();
    await tick(2);
    h.rerender(
      <RecordingBar
        isPaused
        started
        micEnabled
        systemEnabled
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onToggleMic={vi.fn()}
        onToggleSystem={vi.fn()}
      />,
    );
    await tick(3);
    expect(screen.getByText("00:02")).toBeInTheDocument();
  });

  it("stops counting while paused", async () => {
    setup({ isPaused: true });
    await tick(4);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("does not count before the recording has started", async () => {
    setup({ started: false });
    await tick(3);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("picks up the started flag without resetting the elapsed time", async () => {
    const h = setup({ started: false });
    await tick(2);
    expect(screen.getByText("00:00")).toBeInTheDocument();

    h.rerender(
      <RecordingBar
        isPaused={false}
        started
        micEnabled
        systemEnabled
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onToggleMic={vi.fn()}
        onToggleSystem={vi.fn()}
      />,
    );
    await tick(2);
    expect(screen.getByText("00:02")).toBeInTheDocument();
  });

  it("pauses from the play/pause button while running", async () => {
    const h = setup();
    fireEvent.click(screen.getByTitle("Pause"));
    expect(h.onPause).toHaveBeenCalledTimes(1);
    expect(h.onResume).not.toHaveBeenCalled();
  });

  it("resumes from the play/pause button while paused", async () => {
    const h = setup({ isPaused: true });
    fireEvent.click(screen.getByTitle("Resume"));
    expect(h.onResume).toHaveBeenCalledTimes(1);
    expect(h.onPause).not.toHaveBeenCalled();
  });

  it("stops the recording", async () => {
    const h = setup();
    fireEvent.click(screen.getByTitle("Stop"));
    expect(h.onStop).toHaveBeenCalledTimes(1);
  });

  it("cancels the recording", async () => {
    const h = setup();
    fireEvent.click(screen.getByTitle("Cancel recording"));
    expect(h.onCancel).toHaveBeenCalledTimes(1);
  });

  it("mutes the microphone and reports the new state", async () => {
    const h = setup({ micEnabled: true });
    fireEvent.click(screen.getByTitle("Mute microphone"));
    expect(h.onToggleMic).toHaveBeenCalledWith(false);
  });

  it("unmutes the microphone and reports the new state", async () => {
    const h = setup({ micEnabled: false });
    fireEvent.click(screen.getByTitle("Unmute microphone"));
    expect(h.onToggleMic).toHaveBeenCalledWith(true);
  });

  it("reflects the microphone toggle locally after muting", async () => {
    setup({ micEnabled: true });
    fireEvent.click(screen.getByTitle("Mute microphone"));
    expect(screen.getByTitle("Unmute microphone")).toBeInTheDocument();
    expect(screen.queryByTitle("Mute microphone")).not.toBeInTheDocument();
  });

  it("toggles the microphone twice back to enabled", async () => {
    const h = setup({ micEnabled: true });
    fireEvent.click(screen.getByTitle("Mute microphone"));
    fireEvent.click(screen.getByTitle("Unmute microphone"));
    expect(h.onToggleMic).toHaveBeenNthCalledWith(1, false);
    expect(h.onToggleMic).toHaveBeenNthCalledWith(2, true);
  });

  it("mutes the system audio", async () => {
    const h = setup({ systemEnabled: true });
    fireEvent.click(screen.getByTitle("Mute system audio"));
    expect(h.onToggleSystem).toHaveBeenCalledWith(false);
  });

  it("unmutes the system audio", async () => {
    const h = setup({ systemEnabled: false });
    fireEvent.click(screen.getByTitle("Unmute system audio"));
    expect(h.onToggleSystem).toHaveBeenCalledWith(true);
  });

  it("keeps microphone and system toggles independent", async () => {
    const h = setup({ micEnabled: true, systemEnabled: true });
    fireEvent.click(screen.getByTitle("Mute microphone"));
    expect(h.onToggleSystem).not.toHaveBeenCalled();
    expect(screen.getByTitle("Mute system audio")).toBeInTheDocument();
  });

  it("shows both audio source labels", () => {
    setup();
    expect(screen.getByText("Mic")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("stops the interval on unmount", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const view = render(
      <RecordingBar
        isPaused={false}
        started
        micEnabled
        systemEnabled
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onToggleMic={vi.fn()}
        onToggleSystem={vi.fn()}
      />,
    );
    view.unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});