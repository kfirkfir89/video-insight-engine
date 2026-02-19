import { Sparkles, FolderOpen, Search, Library, Brain } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore, useActiveSection } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function LeftSidebarIconStrip() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const activeSection = useActiveSection();
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  const handleTabClick = (section: "summarized" | "memorized") => {
    setActiveSection(section);
    toggleSidebar();
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="h-full w-12 bg-card border-r flex flex-col items-center py-2 gap-1 shrink-0">
        {/* Logo — links to home */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/"
              aria-label="Home"
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <Sparkles className="h-4.5 w-4.5 text-primary" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Home</TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="w-6 h-px bg-border/50 my-1" />

        {/* Summaries tab */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleTabClick("summarized")}
              aria-label="Summaries"
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-lg transition-colors",
                activeSection === "summarized"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Library className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Summaries</TooltipContent>
        </Tooltip>

        {/* Memorized tab */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleTabClick("memorized")}
              aria-label="Memorized"
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-lg transition-colors",
                activeSection === "memorized"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Brain className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Memorized</TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="w-6 h-px bg-border/50 my-1" />

        {/* Open sidebar — folders */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              aria-label="Library"
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <FolderOpen className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Library</TooltipContent>
        </Tooltip>

        {/* Search — opens sidebar with search */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              aria-label="Search"
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Search</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
