import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, HelpCircle, Clock, Lightbulb, Sparkles } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * StreamingDemoLoop — the landing page's hero asset.
 *
 * Simulates the real streaming experience: URL appears → phases
 * cycle → tab pills fill in → content lines populate per tab →
 * brief hold → reset. CSS/JS only, no network. Respects
 * `prefers-reduced-motion` by rendering a static "done" snapshot.
 */

type Phase = "idle" | "getting-ready" | "analyzing" | "extracting" | "streaming" | "done";

interface TabSpec {
  id: string;
  label: string;
  icon: typeof BookOpen;
  title: string;
  lines: readonly string[];
}

const TABS: readonly TabSpec[] = [
  {
    id: "summary",
    label: "Summary",
    icon: BookOpen,
    title: "What this video is really about",
    lines: [
      "A 47-minute deep-dive distilled to the three decisions that matter.",
      "Includes the creator's framework and two worked examples.",
      "Skip to 12:40 for the contrarian take.",
    ],
  },
  {
    id: "key-points",
    label: "Key Points",
    icon: Sparkles,
    title: "The five beats",
    lines: [
      "Start with the problem, not the tool.",
      "Pick one constraint, hold it ruthlessly.",
      "Measure weekly, not daily — noise dominates short windows.",
      "Default to writing before meetings.",
    ],
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: Clock,
    title: "Scrubbable chapters",
    lines: [
      "0:00 — Why most dashboards fail",
      "6:12 — The one-chart rule",
      "18:40 — Live critique of a real dashboard",
      "34:05 — Q&A and contrarian takes",
    ],
  },
  {
    id: "quiz",
    label: "Quiz",
    icon: HelpCircle,
    title: "Check your understanding",
    lines: [
      "Which metric does the speaker explicitly warn against?",
      "Name the two conditions under which weekly review fails.",
      "What does the 'one-chart rule' actually require?",
    ],
  },
  {
    id: "takeaways",
    label: "Takeaways",
    icon: Lightbulb,
    title: "What to actually do Monday",
    lines: [
      "Delete three dashboards you haven't opened in 30 days.",
      "Write your decision before you pull the number.",
      "Replace a recurring meeting with a written update.",
    ],
  },
] as const;

const PHASE_LABELS: Record<Phase, string> = {
  "idle": "Waiting",
  "getting-ready": "Getting ready",
  "analyzing": "Analyzing video",
  "extracting": "Extracting tabs",
  "streaming": "Streaming content",
  "done": "Done",
};

const DEMO_URL = "youtube.com/watch?v=dashboards-that-work";

interface StreamingDemoLoopProps {
  /** Pause the loop — used for testing and when tab is hidden. */
  paused?: boolean;
  /** Portal target for the tab strip (rendered outside the console). */
  tabPortalId?: string;
}

/**
 * Pure-animation demo console. State machine:
 *   idle(400ms) → getting-ready(900ms) → analyzing(900ms)
 *   → extracting(1200ms, tabs appear one by one)
 *   → streaming(per-tab: 900ms each, lines appear one by one)
 *   → done(2000ms hold) → idle
 *
 * Total cycle ≈ 13s. Feels lively without being frantic.
 */
export const StreamingDemoLoop = memo(function StreamingDemoLoop({
  paused = false,
  tabPortalId,
}: StreamingDemoLoopProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(reducedMotion ? "done" : "idle");
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const [visibleLineCount, setVisibleLineCount] = useState<number>(
    reducedMotion ? TABS[0].lines.length : 0,
  );
  const [cycleKey, setCycleKey] = useState<number>(0);
  const [tabHidden, setTabHidden] = useState<boolean>(
    typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Resolve the portal target after first mount
  useEffect(() => {
    if (tabPortalId) {
      setPortalTarget(document.getElementById(tabPortalId));
    }
  }, [tabPortalId]);

  // Pause timers when the tab is backgrounded — prevents runaway setTimeout
  // chains from draining battery/CPU on users who open-then-switch.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = (): void => {
      setTabHidden(document.visibilityState === "hidden");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused || tabHidden) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function schedule(fn: () => void, delay: number): void {
      const t = setTimeout(() => {
        if (!cancelled) fn();
      }, delay);
      timers.push(t);
    }

    // Phase 1: quick idle, then getting ready
    schedule(() => setPhase("getting-ready"), 400);
    // Phase 2: analyzing
    schedule(() => setPhase("analyzing"), 1300);
    // Phase 3: extracting — tabs pop in
    schedule(() => setPhase("extracting"), 2200);

    // Phase 4: streaming — rotate through tabs
    const streamingStart = 2300 + TABS.length * 220 + 400;
    schedule(() => setPhase("streaming"), streamingStart);

    // Each tab: activate, then reveal its lines one-by-one
    let cursor = streamingStart;
    TABS.forEach((tab, tabIdx) => {
      schedule(() => {
        setActiveTabIndex(tabIdx);
        setVisibleLineCount(0);
      }, cursor);
      cursor += 250;
      tab.lines.forEach((_, lineIdx) => {
        schedule(() => setVisibleLineCount(lineIdx + 1), cursor);
        cursor += 260;
      });
      cursor += 400; // pause between tabs
    });

    // Phase 5: done, hold, reset
    schedule(() => setPhase("done"), cursor);
    schedule(() => {
      setPhase("idle");
      setActiveTabIndex(0);
      setVisibleLineCount(0);
      setCycleKey((k) => k + 1);
    }, cursor + 2400);

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [cycleKey, reducedMotion, paused, tabHidden]);

  const activeTab = TABS[activeTabIndex] ?? TABS[0];
  const linesToRender = reducedMotion
    ? activeTab.lines
    : activeTab.lines.slice(0, visibleLineCount);

  const tabStripContent = (
    <div className="landing-hero-tabs" role="presentation">
      <div className="landing-hero-tabs__scroll">
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = i === activeTabIndex && (phase === "streaming" || phase === "done");
          return (
            <span
              key={tab.id}
              className="landing-hero-tabs__tab"
              data-active={isActive}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {tab.label}
            </span>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className="landing-console" aria-hidden="true">
        <div className="landing-console__chrome">
          <span className="landing-console__dot" />
          <span className="landing-console__dot" />
          <span className="landing-console__dot" />
          <span className="landing-console__url">{DEMO_URL}</span>
        </div>

        <div className="landing-console__body">
          <div className="landing-console__phase" data-phase={phase}>
            <span className="landing-console__phase-pulse" />
            <span>{PHASE_LABELS[phase]}</span>
          </div>

          <div className="landing-console__content">
            <div className="landing-console__content-title">{activeTab.title}</div>
            {linesToRender.map((line, i) => (
              <div
                key={`${activeTab.id}-${i}`}
                className="landing-console__line"
                style={{ animationDelay: reducedMotion ? "0ms" : `${i * 30}ms` }}
              >
                <span className="landing-console__line-bullet">{i + 1}</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {portalTarget
        ? createPortal(tabStripContent, portalTarget)
        : !tabPortalId && tabStripContent}
    </>
  );
});
