import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Record from "@/components/Record";
import {
  appSettingsFixture,
  recordingEntry,
  captureEventHandlers,
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

const App = await import("@wailsjs/go/main/App");
const Runtime = await import("@wailsjs/runtime/runtime");
const wails = () => App as unknown as WailsModule;
const runtime = () => Runtime as unknown as WailsModule;

const BASE_URL = "http://127.0.0.1:34116";
const FIRST = "Recording_2024-01-02_10-00-00.mp4";
const SECOND = "Recording_2024-01-01_10-00-00.mp4";

function rec(name: string, overrides: Record<string, unknown> = {}) {
  return recordingEntry({ name, ...overrides });
}

async function renderRecord(props: Record<string, unknown> = {}) {
  const handlers = {
    onBackToPalette: vi.fn(),
    onSwitchToStudio: vi.fn(),
  };
  const view = render(<Record {...handlers} {...props} />);
  await waitFor(() => expect(wails().ListRecordings).toHaveBeenCalled());
  await waitFor(() => {
    if (document.querySelectorAll(".animate-spin").length > 0) {
      throw new Error("still loading");
    }
  });
  return { ...handlers, ...view };
}

describe("Record", () => {
  let handlers: Map<string, (payload?: unknown) => void>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = captureEventHandlers(runtime());
    wails().ListRecordings.mockResolvedValue([rec(FIRST), rec(SECOND)]);
    wails().GetRecordingsBaseURL.mockResolvedValue(BASE_URL);
    wails().GetSettings.mockResolvedValue(appSettingsFixture());
    wails().UpdateSettings.mockResolvedValue(appSettingsFixture());
    wails().DeleteRecording.mockResolvedValue(undefined);
    wails().RenameRecording.mockResolvedValue(undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("loads recordings and the base URL on mount", async () => {
    await renderRecord();
    expect(wails().ListRecordings).toHaveBeenCalledTimes(1);
    expect(wails().GetRecordingsBaseURL).toHaveBeenCalledTimes(1);
  });

  it("shows a card per recording with a date parsed from the filename", async () => {
    await renderRecord();
    expect(screen.getByText(FIRST)).toBeInTheDocument();
    expect(screen.getByText("2024-01-02 10:00")).toBeInTheDocument();
    expect(screen.getByText("2024-01-01 10:00")).toBeInTheDocument();
  });

  it("leaves the date blank for a name without a timestamp", async () => {
    wails().ListRecordings.mockResolvedValue([rec("clip.mp4")]);
    await renderRecord();
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
  });

  it("sorts newest first from the filename timestamp", async () => {
    await renderRecord();
    const names = screen
      .getAllByText(/\.mp4$/)
      .map((el) => el.textContent);
    expect(names).toEqual([FIRST, SECOND]);
  });

  it("sorts oldest first when asked", async () => {
    await renderRecord();
    await userEvent.selectOptions(screen.getByRole("combobox"), "oldest");
    const names = screen.getAllByText(/\.mp4$/).map((el) => el.textContent);
    expect(names).toEqual([SECOND, FIRST]);
  });

  it("sorts alphabetically", async () => {
    await renderRecord();
    await userEvent.selectOptions(screen.getByRole("combobox"), "za");
    const names = screen.getAllByText(/\.mp4$/).map((el) => el.textContent);
    expect(names).toEqual([FIRST, SECOND]);
  });

  it("shows an empty state with no recordings", async () => {
    wails().ListRecordings.mockResolvedValue([]);
    render(<Record onBackToPalette={vi.fn()} onSwitchToStudio={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/No recordings yet/)).toBeInTheDocument(),
    );
  });

  it("shows a search-specific empty state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<Record onBackToPalette={vi.fn()} onSwitchToStudio={vi.fn()} />);
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText("Search..."), {
          target: { value: "nothing" },
        });
        vi.advanceTimersByTime(400);
      });
      await waitFor(() =>
        expect(screen.getByText("No recordings match your search.")).toBeInTheDocument(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("filters by search", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<Record onBackToPalette={vi.fn()} onSwitchToStudio={vi.fn()} />);
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText("Search..."), {
          target: { value: "2024-01-02" },
        });
        vi.advanceTimersByTime(400);
      });
      await waitFor(() =>
        expect(screen.queryByText(SECOND)).not.toBeInTheDocument(),
      );
      expect(screen.getByText(FIRST)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops the loader when listing fails", async () => {
    wails().ListRecordings.mockRejectedValue(new Error("boom"));
    render(<Record onBackToPalette={vi.fn()} onSwitchToStudio={vi.fn()} />);
    await waitFor(() => expect(document.querySelectorAll(".animate-spin")).toHaveLength(0));
    expect(screen.getByText(/No recordings yet/)).toBeInTheDocument();
  });

  it("reloads on refresh", async () => {
    await renderRecord();
    await userEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() => expect(wails().ListRecordings).toHaveBeenCalledTimes(2));
  });

  it("goes back to the palette", async () => {
    const view = await renderRecord();
    await userEvent.click(screen.getByRole("button", { name: /Palette/ }));
    expect(view.onBackToPalette).toHaveBeenCalledTimes(1);
  });

  it("switches to the screenshots view", async () => {
    const view = await renderRecord();
    await userEvent.click(screen.getByRole("button", { name: "Studio" }));
    expect(view.onSwitchToStudio).toHaveBeenCalledTimes(1);
  });

  it("shows a placeholder thumbnail before one is generated", async () => {
    await renderRecord();
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByRole("button", { name: FIRST })).toBeInTheDocument();
  });

  it("subscribes to the thumbnail-ready event", async () => {
    await renderRecord();
    expect(runtime().EventsOn).toHaveBeenCalledWith(
      "thumbnail-ready",
      expect.any(Function),
    );
    expect(handlers.has("thumbnail-ready")).toBe(true);
  });

  it("unsubscribes on unmount", async () => {
    const unsubscribe = vi.fn();
    runtime().EventsOn = vi.fn(() => unsubscribe) as never;
    const view = render(
      <Record onBackToPalette={vi.fn()} onSwitchToStudio={vi.fn()} />,
    );
    await waitFor(() => expect(runtime().EventsOn).toHaveBeenCalled());
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("reveals the thumbnail when the backend reports it ready", async () => {
    wails().ListRecordings.mockResolvedValue([
      rec(FIRST, { thumbnailName: "thumb_a.jpg", thumbnailReady: true }),
    ]);
    await renderRecord();
    const img = screen.getByAltText(FIRST);
    expect(img.getAttribute("src")).toBe(`${BASE_URL}/thumb_a.jpg`);
  });

  it("applies a thumbnail-ready event to the matching recording only", async () => {
    await renderRecord();
    await act(async () => {
      handlers.get("thumbnail-ready")?.({
        video: FIRST,
        thumbnail: "thumb_new.jpg",
      });
    });
    expect(screen.getByAltText(FIRST).getAttribute("src")).toBe(
      `${BASE_URL}/thumb_new.jpg`,
    );
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  it("ignores a thumbnail event for an unknown recording", async () => {
    await renderRecord();
    await act(async () => {
      handlers.get("thumbnail-ready")?.({
        video: "gone.mp4",
        thumbnail: "thumb.jpg",
      });
    });
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("plays a recording when its card is opened", async () => {
    await renderRecord();
    await userEvent.click(screen.getAllByRole("button", { name: FIRST })[0]);
    const source = document.querySelector("video source") as HTMLSourceElement;
    expect(source.getAttribute("src")).toBe(`${BASE_URL}/${FIRST}`);
    expect(source.getAttribute("type")).toBe("video/mp4");
  });

  it("percent-encodes the recording name in the source URL", async () => {
    wails().ListRecordings.mockResolvedValue([rec("my clip.mp4")]);
    await renderRecord();
    await userEvent.click(screen.getByRole("button", { name: "my clip.mp4" }));
    const source = document.querySelector("video source") as HTMLSourceElement;
    expect(source.getAttribute("src")).toBe(`${BASE_URL}/my%20clip.mp4`);
  });

  it("shows the recording name in the player header", async () => {
    await renderRecord();
    await userEvent.click(screen.getAllByRole("button", { name: FIRST })[0]);
    expect(screen.getByText(FIRST)).toBeInTheDocument();
  });

  it("pauses playback when returning to the list", async () => {
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause");
    await renderRecord();
    await userEvent.click(screen.getAllByRole("button", { name: FIRST })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Recordings" }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByText(FIRST)).toBeInTheDocument();
  });

  it("restores favorites from the backend settings", async () => {
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({
        favorites: { recordings: [FIRST], screenshots: [] },
      } as never),
    );
    await renderRecord();
    await waitFor(() =>
      expect(screen.getAllByTitle("Remove from favorites")).toHaveLength(1),
    );
  });

  it("treats missing favorites as an empty set", async () => {
    wails().GetSettings.mockResolvedValue(appSettingsFixture({ favorites: {} } as never));
    await renderRecord();
    await waitFor(() => expect(screen.getAllByTitle("Add to favorites")).toHaveLength(2));
  });

  it("survives a failing settings load", async () => {
    wails().GetSettings.mockRejectedValue(new Error("boom"));
    await renderRecord();
    await waitFor(() => expect(screen.getAllByTitle("Add to favorites")).toHaveLength(2));
  });

  it("persists a favorite through UpdateSettings", async () => {
    await renderRecord();
    await waitFor(() => expect(screen.getAllByTitle("Add to favorites")).toHaveLength(2));
    await userEvent.click(screen.getAllByTitle("Add to favorites")[0]);

    await waitFor(() => expect(wails().UpdateSettings).toHaveBeenCalledTimes(1));
    const sent = wails().UpdateSettings.mock.calls[0][0];
    expect(sent.favorites.recordings).toEqual([FIRST]);
  });

  it("keeps the rest of the settings when saving favorites", async () => {
    await renderRecord();
    await userEvent.click(screen.getAllByTitle("Add to favorites")[0]);
    await waitFor(() => expect(wails().UpdateSettings).toHaveBeenCalled());
    const sent = wails().UpdateSettings.mock.calls[0][0];
    expect(sent.screenshot.saveDir).toBe("/home/test/Pictures/GlowSnap");
  });

  it("removes a favorite again", async () => {
    await renderRecord();
    await userEvent.click(screen.getAllByTitle("Add to favorites")[0]);
    await waitFor(() =>
      expect(screen.getAllByTitle("Remove from favorites")).toHaveLength(1),
    );
    await userEvent.click(screen.getAllByTitle("Remove from favorites")[0]);
    expect(screen.getAllByTitle("Add to favorites")).toHaveLength(2);
  });

  it("filters to favorites only", async () => {
    await renderRecord();
    await userEvent.click(screen.getAllByTitle("Add to favorites")[0]);
    await userEvent.click(screen.getByTitle("Show favorites only"));
    expect(screen.queryByText(SECOND)).not.toBeInTheDocument();
    expect(screen.getByText(FIRST)).toBeInTheDocument();
  });

  it("asks for confirmation before deleting", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderRecord();
    await userEvent.click(screen.getAllByTitle("Delete")[0]);
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith(`Delete ${FIRST}?`));
    expect(wails().DeleteRecording).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("deletes when confirmed and reloads the list", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderRecord();
    await userEvent.click(screen.getAllByTitle("Delete")[0]);
    await waitFor(() => expect(wails().DeleteRecording).toHaveBeenCalledWith(FIRST));
    await waitFor(() => expect(wails().ListRecordings).toHaveBeenCalledTimes(2));
    confirmSpy.mockRestore();
  });

  it("skips confirmation when the setting is off", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({ general: { confirmDelete: false } } as never),
    );
    await renderRecord();
    await userEvent.click(screen.getAllByTitle("Delete")[0]);
    await waitFor(() => expect(wails().DeleteRecording).toHaveBeenCalledWith(FIRST));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("drops a deleted recording from the favorites", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({
        favorites: { recordings: [FIRST], screenshots: [] },
      } as never),
    );
    await renderRecord();
    await waitFor(() =>
      expect(screen.getAllByTitle("Remove from favorites")).toHaveLength(1),
    );
    await userEvent.click(screen.getAllByTitle("Delete")[0]);

    await waitFor(() =>
      expect(
        wails().UpdateSettings.mock.calls.at(-1)?.[0].favorites.recordings,
      ).toEqual([]),
    );
    confirmSpy.mockRestore();
  });

  it("keeps the card when deletion fails", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    wails().DeleteRecording.mockRejectedValue(new Error("boom"));
    await renderRecord();
    await userEvent.click(screen.getAllByTitle("Delete")[0]);
    await waitFor(() => expect(wails().DeleteRecording).toHaveBeenCalled());
    expect(screen.getByText(FIRST)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("renames a recording on Enter", async () => {
    await renderRecord();
    await userEvent.dblClick(screen.getByText(FIRST));
    const input = screen.getByDisplayValue(FIRST);
    fireEvent.change(input, { target: { value: "renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(wails().RenameRecording).toHaveBeenCalledWith(
        FIRST,
        "renamed.mp4",
      ),
    );
  });

  it("does not rename when the name is unchanged", async () => {
    await renderRecord();
    await userEvent.dblClick(screen.getByText(FIRST));
    fireEvent.keyDown(screen.getByDisplayValue(FIRST), { key: "Enter" });
    await act(async () => {});
    expect(wails().RenameRecording).not.toHaveBeenCalled();
  });

  it("does not rename when the input is cleared", async () => {
    await renderRecord();
    await userEvent.dblClick(screen.getByText(FIRST));
    const input = screen.getByDisplayValue(FIRST);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await act(async () => {});
    expect(wails().RenameRecording).not.toHaveBeenCalled();
    expect(screen.getByText(FIRST)).toBeInTheDocument();
  });

  it("commits a rename on blur", async () => {
    await renderRecord();
    await userEvent.dblClick(screen.getByText(FIRST));
    const input = screen.getByDisplayValue(FIRST);
    fireEvent.change(input, { target: { value: "blur.mp4" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(wails().RenameRecording).toHaveBeenCalledWith(FIRST, "blur.mp4"),
    );
  });

  it("reloads the list after a rename", async () => {
    await renderRecord();
    await userEvent.dblClick(screen.getByText(FIRST));
    const input = screen.getByDisplayValue(FIRST);
    fireEvent.change(input, { target: { value: "renamed.mp4" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(wails().ListRecordings).toHaveBeenCalledTimes(2));
  });

  it("keeps the old card when the rename fails", async () => {
    wails().RenameRecording.mockRejectedValue(new Error("boom"));
    await renderRecord();
    await userEvent.dblClick(screen.getByText(FIRST));
    const input = screen.getByDisplayValue(FIRST);
    fireEvent.change(input, { target: { value: "renamed.mp4" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(wails().RenameRecording).toHaveBeenCalled());
    expect(screen.getByText(FIRST)).toBeInTheDocument();
  });

  it("migrates a favorite across a rename", async () => {
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({
        favorites: { recordings: [FIRST], screenshots: [] },
      } as never),
    );
    await renderRecord();
    await waitFor(() =>
      expect(screen.getAllByTitle("Remove from favorites")).toHaveLength(1),
    );
    await userEvent.dblClick(screen.getByText(FIRST));
    const input = screen.getByDisplayValue(FIRST);
    fireEvent.change(input, { target: { value: "renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(
        wails().UpdateSettings.mock.calls.at(-1)?.[0].favorites.recordings,
      ).toEqual(["renamed.mp4"]),
    );
  });
});