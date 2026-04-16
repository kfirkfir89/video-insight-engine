import { memo } from "react";
import { Sparkles, Search, Library, MessageCircle, Command } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore, useActiveSection } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export const LeftSidebarIconStrip = memo(function LeftSidebarIconStrip() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openSidebarSearch = useUIStore((s) => s.openSidebarSearch);
  const activeSection = useActiveSection();
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  const handleTabClick = (section: "summarized" | "assistant") => {
    setActiveSection(section);
    toggleSidebar();
  };

  const openCommandPalette = () => {
    window.dispatchEvent(new CustomEvent("vie:open-command-palette"));
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="h-full w-12 bg-card border-r flex flex-col items-center py-2 gap-1 shrink-0">
        {/* Logo — links to board */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/board"
              aria-label="Home"
              className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <Sparkles className="h-4.5 w-4.5 text-primary" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Home</TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="w-6 h-px bg-border/50 my-1" aria-hidden="true" />

        {/* Collection tab — jumps into summarized section */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleTabClick("summarized")}
              aria-label="Open collection"
              className={cn(
                "h-11 w-11 flex items-center justify-center rounded-lg transition-all",
                activeSection === "summarized"
                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Library className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Open collection</TooltipContent>
        </Tooltip>

        {/* Assistant tab — coral accent for wayfinding contrast with Collection */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleTabClick("assistant")}
              aria-label="Open assistant"
              className={cn(
                "h-11 w-11 flex items-center justify-center rounded-lg transition-all",
                activeSection === "assistant"
                  ? "bg-[oklch(from_var(--vie-coral)_l_c_h_/_0.12)] text-[var(--vie-coral)] ring-1 ring-[oklch(from_var(--vie-coral)_l_c_h_/_0.22)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <MessageCircle className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Assistant</TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="w-6 h-px bg-border/50 my-1" aria-hidden="true" />

        {/* Search — opens sidebar + focuses search panel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={openSidebarSearch}
              aria-label="Search videos"
              className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Search videos</TooltipContent>
        </Tooltip>

        {/* Command palette — global jump */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={openCommandPalette}
              aria-label="Open command palette"
              className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Command className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Command palette <span className="opacity-60 ms-1">⌘K</span></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});
