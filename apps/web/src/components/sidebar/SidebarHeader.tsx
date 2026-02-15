import { memo } from "react";
import { Link } from "react-router-dom";
import { Sparkles, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";

export const SidebarHeader = memo(function SidebarHeader() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 shrink-0">
      {/* Branding - links to home */}
      <Link to="/" className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <span className="font-semibold text-sm truncate">Video Insight</span>
      </Link>

      {/* Sidebar close button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={toggleSidebar}
        title="Hide sidebar"
      >
        <PanelLeftClose className="h-4 w-4" />
      </Button>
    </div>
  );
});
