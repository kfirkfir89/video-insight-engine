import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Provider = "anthropic" | "openai" | "gemini";

interface ProviderSelectorProps {
  value: Provider | null;
  onChange: (value: Provider | null) => void;
  label: string;
  allowNull?: boolean;
}

const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
];

export function ProviderSelector({
  value,
  onChange,
  label,
  allowNull = false,
}: ProviderSelectorProps) {
  const currentLabel = value
    ? PROVIDER_OPTIONS.find((o) => o.value === value)?.label || value
    : "(default)";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground min-w-[60px]">
        {label}:
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border bg-background hover:bg-accent transition-colors"
            aria-label={`Select ${label} provider`}
          >
            <span>{currentLabel}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-32">
          {allowNull && (
            <DropdownMenuItem
              onClick={() => onChange(null)}
              className="flex items-center justify-between text-xs"
            >
              <span>(default)</span>
              {value === null && <Check className="h-3 w-3 text-primary" />}
            </DropdownMenuItem>
          )}
          {PROVIDER_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className="flex items-center justify-between text-xs"
            >
              <span>{option.label}</span>
              {value === option.value && (
                <Check className="h-3 w-3 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
