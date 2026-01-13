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
  const currentOption =
    SORT_OPTIONS.find((o) => o.value === value) || SORT_OPTIONS[0];
  const CurrentIcon = currentOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded-sm hover:bg-accent transition-colors"
          title={`Sort: ${currentOption.label}`}
          aria-label="Change sort order"
        >
          <CurrentIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
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
  );
}
