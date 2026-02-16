import { Sparkles, FolderOpen, Search, User, PanelLeft } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { getInitials } from "@/lib/string-utils";

export function LeftSidebarIconStrip() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full w-12 bg-card border-r flex flex-col items-center py-3 gap-1 shrink-0">
        {/* Expand sidebar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Expand sidebar</TooltipContent>
        </Tooltip>

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

        {/* Search */}
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* User avatar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              aria-label={user?.name ?? "Profile"}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors"
            >
              {user ? getInitials(user.name) : <User className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {user?.name ?? "Profile"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
