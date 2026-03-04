import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimerViewProps {
  durationSeconds: number;
  label?: string;
  children: ReactNode;
  className?: string;
}

export function TimerView({
  durationSeconds,
  label,
  children,
  className,
}: TimerViewProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [running, setRunning] = useState(false);
  const [timerComplete, setTimerComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDuration = useRef(durationSeconds);

  // Sync remaining when durationSeconds prop changes
  useEffect(() => {
    if (prevDuration.current !== durationSeconds) {
      prevDuration.current = durationSeconds;
      setRemaining(durationSeconds);
      setRunning(false);
    }
  }, [durationSeconds]);

  useEffect(() => {
    if (!running) return;
    setTimerComplete(false);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          setTimerComplete(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const toggleRunning = useCallback(() => {
    if (remaining === 0) {
      setRemaining(durationSeconds);
      setTimerComplete(false);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  }, [remaining, durationSeconds]);

  const reset = useCallback(() => {
    setRunning(false);
    setRemaining(durationSeconds);
    setTimerComplete(false);
  }, [durationSeconds]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className={className}>
      {/* Timer display */}
      <div className="flex items-center justify-center gap-4 mb-4 py-4">
        <div className="text-center">
          {label && (
            <div className="text-xs text-muted-foreground mb-2">{label}</div>
          )}
          <div
            className="text-4xl font-mono font-bold tabular-nums timer-glow"
            role="timer"
            aria-live={running ? "off" : "polite"}
            aria-label={`${String(minutes).padStart(2, "0")} minutes ${String(seconds).padStart(2, "0")} seconds remaining`}
          >
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* Screen-reader announcement for timer completion */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {timerComplete && "Timer complete"}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          aria-label="Reset timer"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={toggleRunning}
          className="gap-1.5 min-w-[80px]"
          aria-label={running ? "Pause timer" : "Start timer"}
        >
          {running ? (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {remaining === 0 ? "Restart" : "Start"}
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
