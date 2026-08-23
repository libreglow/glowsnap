import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowLeft, RefreshCw, Film, Search, Star } from "lucide-react";
import { RecordProps, Recording } from "@/types/types";
import {
  ListRecordings,
  GetRecordingsBaseURL,
  GetSettings,
  UpdateSettings,
  DeleteRecording,
} from "../../wailsjs/go/main/App";
import { settings } from "../../wailsjs/go/models";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MediaCard } from "@/components/ui/media-card";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function Record({
  onBackToPalette,
  onSwitchToStudio,
}: RecordProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "az" | "za">(
    "newest",
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await GetSettings();
        if (!active) return;
        setFavorites(new Set(cfg.favorites?.recordings ?? []));
      } catch {
        if (active) setFavorites(new Set());
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveRecordingsFavorites = async (names: Set<string>) => {
    try {
      const cfg = await GetSettings();
      const next = settings.Settings.createFrom({
        ...cfg,
        favorites: { ...(cfg.favorites ?? {}), recordings: [...names] },
      });
      await UpdateSettings(next);
    } catch (err) {
      console.error("Failed to save favorites:", err);
    }
  };

  const toggleFavorite = (fileName: string) => {
    const next = new Set(favorites);
    if (next.has(fileName)) next.delete(fileName);
    else next.add(fileName);
    setFavorites(next);
    void saveRecordingsFavorites(next);
  };

  const loadRecordings = async () => {
    try {
      setLoading(true);
      const files = await ListRecordings();
      const url = await GetRecordingsBaseURL();
      setBaseUrl(url);
      setRecordings(files ?? []);
    } catch (err) {
      console.error("Failed to load recordings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordings();
  }, []);

  const syncRecordings = async () => {
    try {
      const files = await ListRecordings();
      setRecordings(files ?? []);
    } catch (err) {
      console.error("Failed to reload recordings:", err);
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      const cfg = await GetSettings();
      const shouldConfirm = cfg.general?.confirmDelete ?? true;
      if (shouldConfirm && !window.confirm(`Delete ${fileName}?`)) {
        return;
      }
      await DeleteRecording(fileName);
      const next = new Set(favorites);
      next.delete(fileName);
      setFavorites(next);
      void saveRecordingsFavorites(next);
      await syncRecordings();
    } catch (err) {
      console.error("Failed to delete recording:", err);
    }
  };

  const handleSelectRecording = (recording: Recording) => {
    setSelectedRecording(recording);
  };

  const handleBackToList = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setSelectedRecording(null);
  };

  const formatDate = (name: string) => {
    const match = name.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
    if (!match) return "";
    const [, year, month, day, hour, min] = match;
    return `${year}-${month}-${day} ${hour}:${min}`;
  };

  const parseDateFromName = (name: string): number => {
    const match = name.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
    if (!match) return 0;
    const [, year, month, day, hour, min, sec] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(min),
      Number(sec),
    ).getTime();
  };

  const processedRecordings = useMemo(() => {
    let filtered = [...recordings];

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter((r) => favorites.has(r.name));
    }

    switch (sortOrder) {
      case "newest":
        filtered.sort(
          (a, b) => parseDateFromName(b.name) - parseDateFromName(a.name),
        );
        break;
      case "oldest":
        filtered.sort(
          (a, b) => parseDateFromName(a.name) - parseDateFromName(b.name),
        );
        break;
      case "az":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return filtered;
  }, [recordings, debouncedSearch, sortOrder, showFavoritesOnly, favorites]);

  if (selectedRecording) {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen min-h-screen flex flex-col justify-start items-center overflow-hidden text-white bg-black">
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center backdrop-blur-lg w-full px-6 py-3 border-b border-white/10 gap-4">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/15 text-xs border border-white/10 text-white/80 hover:text-white transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>Recordings</span>
          </button>
          <span className="text-xs text-white/50 truncate">
            {selectedRecording.name}
          </span>
        </header>

        <main className="flex-1 min-h-0 w-full h-screen flex items-center justify-center pt-16 px-4">
          <video
            ref={videoRef}
            controls
            autoPlay
            className="w-full h-full max-w-none max-h-[calc(100vh-4rem)] object-contain rounded-none border-0 bg-black"
          >
            <source
              src={`${baseUrl}/${encodeURIComponent(selectedRecording.name)}`}
              type="video/mp4"
            />
            ERROR: While support video tag.
          </video>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen min-h-screen flex flex-col justify-start items-center overflow-hidden text-white bg-black">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center backdrop-blur-lg w-full px-6 py-3 border-b border-white/10 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/15 text-xs border border-white/10 text-white/80 hover:text-white transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>Palette</span>
          </button>
          <h1 className="text-sm font-semibold text-white/90">
            GlowSnap Studio
          </h1>
          <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 ml-auto mr-auto">
          <button
            onClick={onSwitchToStudio}
            className="px-3 py-1 text-xs rounded-md text-white/60 hover:text-white/90 transition-colors"
          >
            Studio
          </button>
          <button className="px-3 py-1 text-xs rounded-md bg-white/15 text-white font-medium">
            Record
          </button>
        </div>
        </div>
        
        <div className="flex items-center gap-3 ml-auto">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-40 h-8 pl-7 pr-2 text-xs bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-white/30 text-white/80"
            />
          </div>

          <div className="relative w-32">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full h-8 pl-2 pr-8 text-xs bg-white/5 border border-white/10 rounded-lg text-white/80 focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
            >
              <option value="newest" className="bg-black">
                Newest
              </option>
              <option value="oldest" className="bg-black">
                Oldest
              </option>
              <option value="az" className="bg-black">
                A-Z
              </option>
              <option value="za" className="bg-black">
                Z-A
              </option>
            </select>

            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19 9-7 7-7-7"
              />
            </svg>
          </div>

          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`p-2 rounded-lg ${showFavoritesOnly ? "bg-yellow-500/20 text-yellow-400" : "bg-white/5 text-white/60"} hover:bg-white/10`}
            title="Show favorites only"
          >
            <Star size={14} />
          </button>

          <button
            onClick={loadRecordings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <ScrollArea className="flex-1 min-h-0 p-4 w-full h-screen mt-16">
        {loading && recordings.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/40">
            <RefreshCw size={32} className="animate-spin" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-white/10 rounded-2xl p-6 text-center text-white/40">
            <Film size={48} className="mb-3 stroke-1" />
            <p className="text-sm">
              No recordings yet. Start a recording from the Palette!
            </p>
          </div>
        ) : processedRecordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-white/10 rounded-2xl p-6 text-center text-white/40">
            <Film size={48} className="mb-3 stroke-1" />
            <p className="text-sm">No recordings match your search.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-white/40 uppercase tracking-wider px-1">
              Recordings
            </span>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-max">
              {processedRecordings.map((rec) => (
                <MediaCard
                  key={rec.name}
                  name={rec.name}
                  dateLabel={formatDate(rec.name)}
                  isFavorite={favorites.has(rec.name)}
                  onOpen={() => handleSelectRecording(rec)}
                  onToggleFavorite={() => toggleFavorite(rec.name)}
                  onDelete={() => handleDelete(rec.name)}
                  thumbnail={
                    rec.thumbnailName ? (
                      <img
                        onClick={() => handleSelectRecording(rec)}
                        src={`${baseUrl}/${encodeURIComponent(rec.thumbnailName)}`}
                        alt={rec.name}
                        className="w-full h-48 object-cover"
                        loading="lazy"
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
