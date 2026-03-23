import { Check, Type } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore, type SidebarTextSize } from "@/stores/ui-store";

const SIZE_OPTIONS: { value: SidebarTextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export function TextSizeToggle() {
  const currentSize = useUIStore((s) => s.sidebarTextSize);
  const setSidebarTextSize = useUIStore((s) => s.setSidebarTextSize);

  return (
    <TooltipProvider delayDuration={400}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity shrink-0"
                aria-label="Change text size"
                onClick={(e) => e.stopPropagation()}
              >
                <Type className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Change text size
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-32">
          {SIZE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setSidebarTextSize(option.value)}
              className="flex items-center justify-between"
            >
              <span>{option.label}</span>
              {currentSize === option.value && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
