import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  id: string | null;
  label: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
  className?: string;
}

export function Breadcrumb({ items, onNavigate, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1 text-sm flex-wrap", className)}
    >
      {items.map((item, index) => (
        <div key={item.id ?? "root"} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          {index === items.length - 1 ? (
            <span className="font-semibold text-foreground text-2xl">
              {item.label}
            </span>
          ) : (
            <button
              onClick={() => onNavigate(item.id)}
              className="text-muted-foreground hover:text-foreground hover:underline transition-colors truncate max-w-[150px]"
            >
              {item.label}
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
