import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Film, Search } from "lucide-react";
import { RecordProps, Recording } from "@/types/types";
import {
  ListRecordings,
  GetRecordingsBaseURL,
} from "../../wailsjs/go/main/App";
import { ScrollArea } from "@/components/ui/scroll-area";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function Record({ onBackToPalette, onSwitchToStudio }: RecordProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "az" | "za">(
    "newest",
  );
  const videoRef = useRef<HTMLVideoElement>(null);

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

    switch (sortOrder) {
      case "newest":
        filtered.sort((a, b) => parseDateFromName(b.name) - parseDateFromName(a.name));
        break;
      case "oldest":
        filtered.sort((a, b) => parseDateFromName(a.name) - parseDateFromName(b.name));
        break;
      case "az":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return filtered;
  }, [recordings, debouncedSearch, sortOrder]);

  if (selectedRecording) {
    return (
      <motion.div
        key="record-player"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full h-full flex flex-col justify-start items-center rounded-3xl backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden text-white bg-black"
      >
        <header className="flex items-center z-50 backdrop-blur-lg w-full px-6 py-3 border-b border-white/10 shrink-0 fixed top-0 left-0 gap-4">
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

        <div className="flex-1 w-full h-full flex items-center justify-center mt-12 pt-4 px-4">
          <video
            ref={videoRef}
            controls
            autoPlay
            className="max-w-2xl w-full max-h-[70vh] object-contain rounded-xl border border-white/10 bg-black"
          >
            <source
              src={`${baseUrl}/${encodeURIComponent(selectedRecording.name)}`}
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="record"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="w-full h-full flex flex-col justify-start items-center rounded-3xl backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden text-white bg-black"
    >
      <header className="flex items-center z-50 backdrop-blur-lg w-full px-6 py-3 border-b border-white/10 shrink-0 fixed top-0 left-0 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/15 text-xs border border-white/10 text-white/80 hover:text-white transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>Palette</span>
          </button>
          <h1 className="text-sm font-semibold text-white/90">
            GlowSnap
          </h1>
        </div>

        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 ml-auto mr-auto">
          <button
            onClick={onSwitchToStudio}
            className="px-3 py-1 text-xs rounded-md text-white/60 hover:text-white/90 transition-colors"
          >
            Studio
          </button>
          <button
            className="px-3 py-1 text-xs rounded-md bg-white/15 text-white font-medium"
          >
            Record
          </button>
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
            onClick={loadRecordings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <ScrollArea className="flex-1 p-4 w-full h-[95vh] mt-16">
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
            <div className="flex flex-col gap-0.5">
              {processedRecordings.map((rec) => (
                <button
                  key={rec.name}
                  onClick={() => handleSelectRecording(rec)}
                  className="text-left px-3 py-2 rounded-lg text-xs transition-colors text-white/60 hover:bg-white/5 hover:text-white/90"
                >
                  <span className="block truncate">{rec.name}</span>
                  {formatDate(rec.name) && (
                    <span className="text-[10px] text-white/30">
                      {formatDate(rec.name)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </motion.div>
  );
}