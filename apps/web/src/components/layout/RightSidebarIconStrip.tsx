import { List, MessageCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore } from "@/stores/ui-store";

export function RightSidebarIconStrip() {
  const toggleRightSidebar = useUIStore((s) => s.toggleRightSidebar);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full w-12 bg-card border-l flex flex-col items-center py-3 gap-1 shrink-0">
        {/* Chapters */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleRightSidebar}
              aria-label="Chapters"
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <List className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">Chapters</TooltipContent>
        </Tooltip>

        {/* Chat */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleRightSidebar}
              aria-label="Chat"
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">Chat</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
