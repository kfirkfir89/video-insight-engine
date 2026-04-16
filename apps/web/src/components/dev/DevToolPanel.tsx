import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, RefreshCw, Wrench, Video, ListVideo, Palette } from "lucide-react";
import { ProviderSelector, type Provider } from "./ProviderSelector";
import { useAddVideo } from "@/hooks/use-videos";
import { usePlaylistPreview, usePlaylistImport } from "@/hooks/use-playlists";
import { type ProviderConfig } from "@/api/videos";
import { cn } from "@/lib/utils";

// Only export in dev mode
if (!import.meta.env.DEV) {
  throw new Error("DevToolPanel should not be imported in production");
}

type Mode = "video" | "playlist";

export function DevToolPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("video");
  const [bypassCache, setBypassCache] = useState(true);
  const [defaultProvider, setDefaultProvider] = useState<Provider>("anthropic");
  const [fastProvider, setFastProvider] = useState<Provider | null>(null);
  const [fallbackProvider, setFallbackProvider] = useState<Provider | null>(
    null
  );

  const addVideo = useAddVideo();
  const previewPlaylist = usePlaylistPreview();
  const importPlaylist = usePlaylistImport();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const providers: ProviderConfig = {
      default: defaultProvider,
      ...(fastProvider && { fast: fastProvider }),
      ...(fallbackProvider !== null && { fallback: fallbackProvider }),
    };

    try {
      if (mode === "video") {
        await addVideo.mutateAsync({
          url: url.trim(),
          bypassCache,
          providers,
        });
      } else {
        await previewPlaylist.mutateAsync({ url: url.trim() });
        await importPlaylist.mutateAsync({
          url: url.trim(),
          providers,
        });
      }
      setUrl("");
    } catch {
      // Error handled by mutation
    }
  };

  const isLoading = addVideo.isPending || previewPlaylist.isPending || importPlaylist.isPending;
  const isError = addVideo.isError || previewPlaylist.isError || importPlaylist.isError;
  const isSuccess = addVideo.isSuccess || importPlaylist.isSuccess;
  const errorMessage = addVideo.error?.message || previewPlaylist.error?.message || importPlaylist.error?.message;

  return (
    <div className="border-t border-warning/30 bg-warning/5">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-warning hover:bg-warning/10 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Wrench className="h-3 w-3" />
        <span className="font-medium">Dev Tools</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning">
          DEV
        </span>
      </button>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="px-3 pb-3 space-y-3">
          {/* Mode Toggle */}
          <div className="flex gap-1 p-0.5 bg-warning/10 rounded">
            <button
              type="button"
              onClick={() => setMode("video")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded transition-colors",
                mode === "video"
                  ? "bg-warning/30 text-warning-foreground"
                  : "text-muted-foreground hover:text-warning"
              )}
            >
              <Video className="h-3 w-3" />
              Video
            </button>
            <button
              type="button"
              onClick={() => setMode("playlist")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded transition-colors",
                mode === "playlist"
                  ? "bg-warning/30 text-warning-foreground"
                  : "text-muted-foreground hover:text-warning"
              )}
            >
              <ListVideo className="h-3 w-3" />
              Playlist
            </button>
          </div>

          {/* Video URL Input */}
          <div>
            <label htmlFor="dev-url-input" className="block text-[10px] text-muted-foreground mb-1">
              {mode === "video" ? "Video URL" : "Playlist URL"}
            </label>
            <input
              id="dev-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                mode === "video"
                  ? "https://youtube.com/watch?v=..."
                  : "https://youtube.com/playlist?list=..."
              }
              className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
            />
          </div>

          {/* Provider Selectors */}
          <div className="space-y-2">
            <label className="block text-[10px] text-muted-foreground">
              LLM Providers
            </label>
            <ProviderSelector
              label="Default"
              value={defaultProvider}
              onChange={(v) => v && setDefaultProvider(v)}
            />
            <ProviderSelector
              label="Fast"
              value={fastProvider}
              onChange={setFastProvider}
              allowNull
            />
            <ProviderSelector
              label="Fallback"
              value={fallbackProvider}
              onChange={setFallbackProvider}
              allowNull
            />
          </div>

          {/* Bypass Cache Toggle */}
          {mode === "video" && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dev-bypass-cache"
                checked={bypassCache}
                onChange={(e) => setBypassCache(e.target.checked)}
                className="h-3 w-3 rounded border-border accent-warning"
              />
              <label
                htmlFor="dev-bypass-cache"
                className="text-[10px] text-muted-foreground cursor-pointer"
              >
                Bypass cache (force re-summarization)
              </label>
            </div>
          )}

          {/* Dev Pages Links */}
          <div className="border-t border-warning/20 pt-3">
            <label className="block text-[10px] text-muted-foreground mb-2">
              Dev Pages
            </label>
            <div className="flex gap-2">
              <Link
                to="/dev/design-system"
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded",
                  "bg-warning/10 text-warning",
                  "hover:bg-warning/20 transition-colors"
                )}
              >
                <Palette className="h-3 w-3" />
                Design System
              </Link>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded",
              "bg-warning/20 text-warning",
              "hover:bg-warning/30 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                {mode === "video" ? "Summarizing..." : "Importing..."}
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                {mode === "video" ? "Re-summarize" : "Import Playlist"}
              </>
            )}
          </button>

          {/* Status */}
          {isError && (
            <p className="text-[10px] text-destructive">
              Error: {errorMessage || "Failed to process"}
            </p>
          )}
          {isSuccess && (
            <p className="text-[10px] text-success">
              {mode === "video" ? "Summarization started!" : "Playlist imported!"}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
