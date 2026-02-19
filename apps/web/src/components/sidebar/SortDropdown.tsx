import { useState } from "react";
import {
  Check,
  ArrowDownAZ,
  ArrowUpZA,
  CalendarArrowDown,
  CalendarArrowUp,
} from "lucide-react";
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
import type { SortOption } from "@/stores/ui-store";

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: {
  value: SortOption;
  label: string;
  icon: typeof ArrowDownAZ;
}[] = [
  { value: "name-asc", label: "Name (A-Z)", icon: ArrowDownAZ },
  { value: "name-desc", label: "Name (Z-A)", icon: ArrowUpZA },
  { value: "created-desc", label: "Newest first", icon: CalendarArrowDown },
  { value: "created-asc", label: "Oldest first", icon: CalendarArrowUp },
];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const currentOption =
    SORT_OPTIONS.find((o) => o.value === value) || SORT_OPTIONS[0];
  const CurrentIcon = currentOption.icon;

  return (
    <TooltipProvider delayDuration={400}>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <Tooltip open={dropdownOpen ? false : undefined}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-center w-full h-full hover:bg-accent/70 transition-colors"
              aria-label="Change sort order"
            >
              <CurrentIcon className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Sort: {currentOption.label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Sort by
        </div>
        {SORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {option.label}
              </span>
              {value === option.value && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
