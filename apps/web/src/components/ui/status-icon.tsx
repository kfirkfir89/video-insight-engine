import { Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type VideoStatus = "pending" | "processing" | "completed" | "failed";

const STATUS_STYLES = {
  pending: "text-status-pending",
  processing: "text-status-processing",
  completed: "text-status-success",
  failed: "text-status-error",
} as const;

const STATUS_ICONS = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
} as const;

interface StatusIconProps {
  status: VideoStatus;
  className?: string;
  size?: number;
}

export function StatusIcon({ status, className, size = 16 }: StatusIconProps) {
  const Icon = STATUS_ICONS[status];
  const isSpinning = status === "processing";

  return (
    <Icon
      size={size}
      className={cn(
        STATUS_STYLES[status],
        isSpinning && "animate-spin",
        className
      )}
    />
  );
}
