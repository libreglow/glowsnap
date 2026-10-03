import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Studio from "@/components/Studio";
import {
  appSettingsFixture,
  screenshotEntry,
  wailsModuleMock,
  type WailsModule,
} from "@tests/test-support/wails";

vi.mock("@wailsjs/go/main/App", async () => {
  const { wailsModuleMock } = await import("@tests/test-support/wails");
  return wailsModuleMock();
});

// The editor pulls in Konva, which needs a real 2D canvas context. Studio only
// has to hand it an image URL, so it is replaced with a probe.
vi.mock("@/components/editor/Editor", () => ({
  default: ({ imageUrl, onBack }: { imageUrl: string; onBack: () => void }) => (
    <div>
      <span data-testid="editor-url">{imageUrl}</span>
      <button onClick={onBack}>Back to gallery</button>
    </div>
  ),
}));

const App = await import("@wailsjs/go/main/App");
const wails = () => App as unknown as WailsModule;

const DAY = 86_400;

function shot(name: string, dayOffset = 0, size = 2048) {
  return screenshotEntry({
    name,
    size,
    date: 1_704_096_000 - dayOffset * DAY,
  });
}

const SHOTS = [shot("shot_a.png", 0), shot("shot_b.png", 1)];

function setup(props: Record<string, unknown> = {}) {
  const handlers = {
    onBackToPalette: vi.fn(),
    onSwitchToRecord: vi.fn(),
  };
  const view = render(<Studio {...handlers} {...props} />);
  return { ...handlers, ...view };
}

async function renderStudio(props: Record<string, unknown> = {}) {
  const view = setup(props);
  await waitFor(() => expect(wails().ListScreenshots).toHaveBeenCalled());
  await waitFor(() => {
    const spinner = document.querySelectorAll(".animate-spin");
    if (spinner.length > 0) throw new Error("still loading");
  });
  return view;
}

/** Silences the component's debug logging for the duration of a test. */
function muteConsole() {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return () => {
    log.mockRestore();
    error.mockRestore();
  };
}

describe("Studio", () => {
  let unmute: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    wails().ListScreenshots.mockResolvedValue(SHOTS);
    wails().GetScreenshotsBaseURL.mockResolvedValue("http://127.0.0.1:34115");
    wails().RenameScreenshot.mockResolvedValue(undefined);
    wails().DeleteScreenshot.mockResolvedValue(undefined);
    wails().GetSettings.mockResolvedValue(appSettingsFixture());
    unmute = muteConsole();
  });

  afterEach(() => {
    unmute();
  });

  it("loads screenshots and the base URL on mount", async () => {
    await renderStudio();
    expect(wails().ListScreenshots).toHaveBeenCalledTimes(1);
    expect(wails().GetScreenshotsBaseURL).toHaveBeenCalledTimes(1);
  });

  it("renders a card per screenshot", async () => {
    await renderStudio();
    expect(screen.getByAltText("shot_a.png")).toBeInTheDocument();
    expect(screen.getByAltText("shot_b.png")).toBeInTheDocument();
  });

  it("builds thumbnail URLs from the base URL and an encoded name", async () => {
    await renderStudio();
    const img = screen.getByAltText("shot_a.png");
    expect(img.getAttribute("src")).toBe("http://127.0.0.1:34115/shot_a.png");
  });

  it("percent-encodes names with spaces", async () => {
    wails().ListScreenshots.mockResolvedValue([shot("my shot.png")]);
    await renderStudio();
    expect(screen.getByAltText("my shot.png").getAttribute("src")).toBe(
      "http://127.0.0.1:34115/my%20shot.png",
    );
  });

  it("formats the file size", async () => {
    wails().ListScreenshots.mockResolvedValue([
      shot("small.png", 0, 512),
      shot("kb.png", 1, 2048),
      shot("mb.png", 2, 3 * 1024 * 1024),
    ]);
    await renderStudio();
    expect(screen.getByText("512 B")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("3.0 MB")).toBeInTheDocument();
  });

  it("shows an empty state with no screenshots", async () => {
    wails().ListScreenshots.mockResolvedValue([]);
    render(<Studio onBackToPalette={vi.fn()} onSwitchToRecord={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/No screenshots yet/)).toBeInTheDocument(),
    );
  });

  it("shows the loader before the first result", async () => {
    let resolve: (v: unknown) => void = () => {};
    wails().ListScreenshots.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<Studio onBackToPalette={vi.fn()} onSwitchToRecord={vi.fn()} />);
    expect(document.querySelector(".animate-spin")).not.toBeNull();

    await act(async () => {
      resolve(SHOTS);
    });
    await waitFor(() => expect(document.querySelector(".animate-spin")).toBeNull());
  });

  it("stops the loader when listing fails", async () => {
    wails().ListScreenshots.mockRejectedValue(new Error("boom"));
    render(<Studio onBackToPalette={vi.fn()} onSwitchToRecord={vi.fn()} />);
    await waitFor(() => expect(document.querySelector(".animate-spin")).toBeNull());
    expect(screen.getByText(/No screenshots yet/)).toBeInTheDocument();
  });

  it("goes back to the palette", async () => {
    const view = await renderStudio();
    await userEvent.click(screen.getByRole("button", { name: /Palette/ }));
    expect(view.onBackToPalette).toHaveBeenCalledTimes(1);
  });

  it("switches to the recordings view", async () => {
    const view = await renderStudio();
    await userEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(view.onSwitchToRecord).toHaveBeenCalledTimes(1);
  });

  it("reloads on refresh", async () => {
    await renderStudio();
    await userEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() => expect(wails().ListScreenshots).toHaveBeenCalledTimes(2));
  });

  it("filters by search after the debounce", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<Studio onBackToPalette={vi.fn()} onSwitchToRecord={vi.fn()} />);
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText("Search..."), {
          target: { value: "shot_b" },
        });
        vi.advanceTimersByTime(400);
      });
      await waitFor(() =>
        expect(screen.queryByAltText("shot_a.png")).not.toBeInTheDocument(),
      );
      expect(screen.getByAltText("shot_b.png")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a search that matches nothing by clearing the filter", async () => {
    await renderStudio();
    const input = screen.getByPlaceholderText("Search...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "zzz" } });
    });
    await waitFor(() =>
      expect(screen.getByText(/No screenshots yet/)).toBeInTheDocument(),
    );
  });

  it("sorts newest first by default", async () => {
    wails().ListScreenshots.mockResolvedValue([
      shot("older.png", 5),
      shot("newer.png", 0),
    ]);
    await renderStudio();
    const names = screen
      .getAllByAltText(/\.png$/)
      .map((img) => img.getAttribute("alt"));
    expect(names).toEqual(["newer.png", "older.png"]);
  });

  it("sorts oldest first when asked", async () => {
    wails().ListScreenshots.mockResolvedValue([
      shot("older.png", 5),
      shot("newer.png", 0),
    ]);
    await renderStudio();
    await userEvent.selectOptions(screen.getByRole("combobox"), "oldest");
    const names = screen
      .getAllByAltText(/\.png$/)
      .map((img) => img.getAttribute("alt"));
    expect(names).toEqual(["older.png", "newer.png"]);
  });

  it("sorts alphabetically", async () => {
    wails().ListScreenshots.mockResolvedValue([
      shot("charlie.png", 0),
      shot("alpha.png", 1),
    ]);
    await renderStudio();
    await userEvent.selectOptions(screen.getByRole("combobox"), "az");
    const names = screen
      .getAllByAltText(/\.png$/)
      .map((img) => img.getAttribute("alt"));
    expect(names).toEqual(["alpha.png", "charlie.png"]);
  });

  it("favorites a screenshot and persists it", async () => {
    await renderStudio();
    await userEvent.click(screen.getAllByTitle("Add to favorites")[0]);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("glowsnap-favorites") ?? "[]")).toEqual([
        "shot_a.png",
      ]),
    );
    expect(screen.getAllByTitle("Remove from favorites")).toHaveLength(1);
  });

  it("unfavorites a screenshot", async () => {
    await renderStudio();
    await userEvent.click(screen.getAllByTitle("Add to favorites")[0]);
    await userEvent.click(screen.getAllByTitle("Remove from favorites")[0]);
    expect(screen.getAllByTitle("Add to favorites")).toHaveLength(2);
  });

  it("restores favorites from localStorage", async () => {
    localStorage.setItem(
      "glowsnap-favorites",
      JSON.stringify(["shot_b.png"]),
    );
    await renderStudio();
    expect(screen.getAllByTitle("Remove from favorites")).toHaveLength(1);
  });

  it("ignores corrupt favorite storage", async () => {
    localStorage.setItem("glowsnap-favorites", "{not json");
    await renderStudio();
    expect(screen.getAllByTitle("Add to favorites")).toHaveLength(2);
  });

  it("filters to favorites only", async () => {
    await renderStudio();
    await userEvent.click(screen.getAllByTitle("Add to favorites")[0]);
    await userEvent.click(screen.getByTitle("Show favorites only"));
    expect(screen.queryByAltText("shot_b.png")).not.toBeInTheDocument();
    expect(screen.getByAltText("shot_a.png")).toBeInTheDocument();
  });

  it("shows everything again when the favorites filter is cleared", async () => {
    await renderStudio();
    await userEvent.click(screen.getByTitle("Show favorites only"));
    await userEvent.click(screen.getByTitle("Show favorites only"));
    expect(screen.getByAltText("shot_a.png")).toBeInTheDocument();
    expect(screen.getByAltText("shot_b.png")).toBeInTheDocument();
  });

  it("renames a screenshot on Enter", async () => {
    await renderStudio();
    const name = screen.getByText("shot_a.png");
    await userEvent.dblClick(name);
    const input = screen.getByDisplayValue("shot_a.png");
    fireEvent.change(input, { target: { value: "renamed.png" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(wails().RenameScreenshot).toHaveBeenCalledWith(
        "shot_a.png",
        "renamed.png",
      ),
    );
  });

  it("keeps the original extension when the new name has none", async () => {
    await renderStudio();
    await userEvent.dblClick(screen.getByText("shot_a.png"));
    const input = screen.getByDisplayValue("shot_a.png");
    fireEvent.change(input, { target: { value: "renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(wails().RenameScreenshot).toHaveBeenCalledWith(
        "shot_a.png",
        "renamed.png",
      ),
    );
  });

  it("trims whitespace from the new name", async () => {
    await renderStudio();
    await userEvent.dblClick(screen.getByText("shot_a.png"));
    const input = screen.getByDisplayValue("shot_a.png");
    fireEvent.change(input, { target: { value: "  spaced.png  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(wails().RenameScreenshot).toHaveBeenCalledWith(
        "shot_a.png",
        "spaced.png",
      ),
    );
  });

  it("does not rename when the name is unchanged", async () => {
    await renderStudio();
    await userEvent.dblClick(screen.getByText("shot_a.png"));
    fireEvent.keyDown(screen.getByDisplayValue("shot_a.png"), { key: "Enter" });
    await act(async () => {});
    expect(wails().RenameScreenshot).not.toHaveBeenCalled();
  });

  it("does not rename when the input is cleared", async () => {
    await renderStudio();
    await userEvent.dblClick(screen.getByText("shot_a.png"));
    const input = screen.getByDisplayValue("shot_a.png");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await act(async () => {});
    expect(wails().RenameScreenshot).not.toHaveBeenCalled();
    expect(screen.getByText("shot_a.png")).toBeInTheDocument();
  });

  it("commits a rename on blur", async () => {
    await renderStudio();
    await userEvent.dblClick(screen.getByText("shot_a.png"));
    const input = screen.getByDisplayValue("shot_a.png");
    fireEvent.change(input, { target: { value: "blur.png" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(wails().RenameScreenshot).toHaveBeenCalledWith(
        "shot_a.png",
        "blur.png",
      ),
    );
  });

  it("reloads the list after a rename", async () => {
    await renderStudio();
    await userEvent.dblClick(screen.getByText("shot_a.png"));
    const input = screen.getByDisplayValue("shot_a.png");
    fireEvent.change(input, { target: { value: "renamed.png" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(wails().ListScreenshots).toHaveBeenCalledTimes(2));
  });

  it("keeps the old card when the rename fails", async () => {
    wails().RenameScreenshot.mockRejectedValue(new Error("boom"));
    await renderStudio();
    await userEvent.dblClick(screen.getByText("shot_a.png"));
    const input = screen.getByDisplayValue("shot_a.png");
    fireEvent.change(input, { target: { value: "renamed.png" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(wails().RenameScreenshot).toHaveBeenCalled());
    expect(screen.getByText("shot_a.png")).toBeInTheDocument();
  });

  it("migrates a favorite across a rename", async () => {
    await renderStudio();
    await userEvent.click(screen.getAllByTitle("Add to favorites")[0]);
    await userEvent.dblClick(screen.getByText("shot_a.png"));
    const input = screen.getByDisplayValue("shot_a.png");
    fireEvent.change(input, { target: { value: "renamed.png" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("glowsnap-favorites") ?? "[]")).toEqual([
        "renamed.png",
      ]),
    );
  });

  it("asks for confirmation before deleting", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderStudio();
    await userEvent.click(screen.getAllByTitle("Delete")[0]);

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith("Delete shot_a.png?"));
    expect(wails().DeleteScreenshot).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("deletes when the confirmation is accepted", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderStudio();
    await userEvent.click(screen.getAllByTitle("Delete")[0]);

    await waitFor(() =>
      expect(wails().DeleteScreenshot).toHaveBeenCalledWith("shot_a.png"),
    );
    await waitFor(() => expect(wails().ListScreenshots).toHaveBeenCalledTimes(2));
    confirmSpy.mockRestore();
  });

  it("skips the confirmation when the setting is off", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({ general: { confirmDelete: false } } as never),
    );
    await renderStudio();
    await userEvent.click(screen.getAllByTitle("Delete")[0]);

    await waitFor(() =>
      expect(wails().DeleteScreenshot).toHaveBeenCalledWith("shot_a.png"),
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("keeps the card when deletion fails", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    wails().DeleteScreenshot.mockRejectedValue(new Error("boom"));
    await renderStudio();
    await userEvent.click(screen.getAllByTitle("Delete")[0]);

    await waitFor(() => expect(wails().DeleteScreenshot).toHaveBeenCalled());
    expect(screen.getByAltText("shot_a.png")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("opens the editor for the clicked screenshot", async () => {
    await renderStudio();
    await userEvent.click(screen.getByAltText("shot_a.png"));
    expect(screen.getByTestId("editor-url").textContent).toBe(
      "http://127.0.0.1:34115/shot_a.png",
    );
    expect(screen.queryByText("GlowSnap Studio")).not.toBeInTheDocument();
  });

  it("encodes the name for the editor URL", async () => {
    wails().ListScreenshots.mockResolvedValue([shot("my shot.png")]);
    await renderStudio();
    await userEvent.click(screen.getByAltText("my shot.png"));
    expect(screen.getByTestId("editor-url").textContent).toBe(
      "http://127.0.0.1:34115/my%20shot.png",
    );
  });

  it("returns to the gallery from the editor", async () => {
    await renderStudio();
    await userEvent.click(screen.getByAltText("shot_a.png"));
    await userEvent.click(screen.getByRole("button", { name: "Back to gallery" }));
    expect(screen.getByText("GlowSnap Studio")).toBeInTheDocument();
    expect(screen.getByAltText("shot_a.png")).toBeInTheDocument();
  });

  it("does not open the editor when only the name is clicked", async () => {
    await renderStudio();
    await userEvent.click(screen.getByText("shot_a.png"));
    expect(screen.getByText("GlowSnap Studio")).toBeInTheDocument();
  });

  it("paginates at fifty images per page", async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      shot(`shot_${String(i).padStart(3, "0")}.png`),
    );
    wails().ListScreenshots.mockResolvedValue(many);
    await renderStudio();

    expect(screen.getAllByAltText(/\.png$/)).toHaveLength(50);
    const loadMore = screen.getByRole("button", { name: /Load More/ });
    expect(loadMore.textContent).toContain("10 remaining");

    await userEvent.click(loadMore);
    expect(screen.getAllByAltText(/\.png$/)).toHaveLength(60);
  });

  it("keeps the size label next to each card", async () => {
    await renderStudio();
    const card = screen.getByText("shot_a.png").closest("div.p-2.text-xs") as HTMLElement;
    expect(within(card).getByText("2.0 KB")).toBeInTheDocument();
  });
});