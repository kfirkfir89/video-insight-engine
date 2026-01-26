import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Wrench } from "lucide-react";
import { ProviderSelector, type Provider } from "./ProviderSelector";
import { useAddVideo } from "@/hooks/use-videos";
import { type ProviderConfig } from "@/api/videos";
import { cn } from "@/lib/utils";

// Only export in dev mode
if (!import.meta.env.DEV) {
  throw new Error("DevToolPanel should not be imported in production");
}

export function DevToolPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [bypassCache, setBypassCache] = useState(true);
  const [defaultProvider, setDefaultProvider] = useState<Provider>("anthropic");
  const [fastProvider, setFastProvider] = useState<Provider | null>(null);
  const [fallbackProvider, setFallbackProvider] = useState<Provider | null>(
    null
  );

  const addVideo = useAddVideo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const providers: ProviderConfig = {
      default: defaultProvider,
      ...(fastProvider && { fast: fastProvider }),
      ...(fallbackProvider !== null && { fallback: fallbackProvider }),
    };

    try {
      await addVideo.mutateAsync({
        url: url.trim(),
        bypassCache,
        providers,
      });
      setUrl("");
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="border-t border-yellow-500/30 bg-yellow-500/5">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Wrench className="h-3 w-3" />
        <span className="font-medium">Dev Tools</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
          DEV
        </span>
      </button>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="px-3 pb-3 space-y-3">
          {/* Video URL Input */}
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1">
              Video URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
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
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dev-bypass-cache"
              checked={bypassCache}
              onChange={(e) => setBypassCache(e.target.checked)}
              className="h-3 w-3 rounded border-border accent-yellow-500"
            />
            <label
              htmlFor="dev-bypass-cache"
              className="text-[10px] text-muted-foreground cursor-pointer"
            >
              Bypass cache (force re-summarization)
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!url.trim() || addVideo.isPending}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded",
              "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
              "hover:bg-yellow-500/30 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {addVideo.isPending ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                Summarizing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                Re-summarize
              </>
            )}
          </button>

          {/* Status */}
          {addVideo.isError && (
            <p className="text-[10px] text-red-500">
              Error: {addVideo.error?.message || "Failed to summarize"}
            </p>
          )}
          {addVideo.isSuccess && (
            <p className="text-[10px] text-green-500">
              Summarization started!
            </p>
          )}
        </form>
      )}
    </div>
  );
}
