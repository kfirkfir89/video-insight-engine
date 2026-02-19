import { memo } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export const SidebarHeader = memo(function SidebarHeader() {
  return (
    <div className="flex items-center px-3 h-13 border-b border-border/50 shrink-0">
      {/* Branding - links to home */}
      <Link to="/" className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <span className="font-semibold text-sm truncate">Video Insight</span>
      </Link>
    </div>
  );
});
