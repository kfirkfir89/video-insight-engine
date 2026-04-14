/**
 * SSE event processor for video summarization stream.
 * Maps incoming events to StreamState updates.
 */

import type { Dispatch, SetStateAction } from "react";
import {
  validateMetadataEvent,
  validateSynthesisComplete,
  validateDoneEvent,
  validateErrorEvent,
  validatePhaseEvent,
} from "@/features/video-output/lib/streaming/sse-validators";
import { getUserFriendlyError } from "@/features/video-output/lib/streaming/stream-error-messages";
import type { StreamState, FrameInfo } from "@/features/video-output/hooks/use-summary-stream";
import type { ContentTag, TabDefinition, TabEntry, VIEResponseMeta, EnrichmentData, QuizQuestion, Flashcard, CodeCheatSheetItem, ScenarioItem, Modifier } from "@vie/types";

type SetState = Dispatch<SetStateAction<StreamState>>;

// ─── Type validation helpers ───

function isValidContentTag(v: unknown): v is ContentTag {
  return typeof v === "string" && v.length > 0;
}

function isValidModifier(v: unknown): v is Modifier {
  return typeof v === "object" && v !== null && "name" in v && typeof (v as Record<string, unknown>).name === "string";
}

function isValidTabDefinition(v: unknown): v is TabDefinition {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.label === "string";
}

function isValidTabLabel(v: unknown): v is { id: string; label: string; emoji: string } {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.label === "string" && typeof obj.emoji === "string";
}

function isValidCrossTabLink(v: unknown): v is { targetTab: string; label: string } {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.targetTab === "string" && typeof obj.label === "string";
}

// ─── Event Handlers (grouped by domain) ───

function handlePhaseEvent(event: Record<string, unknown>, setState: SetState): void {
  const phase = validatePhaseEvent(event);
  if (phase) {
    setState((prev) => ({ ...prev, phase: phase as StreamState["phase"] }));
  }
}

function handleMetadataEvent(event: Record<string, unknown>, setState: SetState): void {
  const metadata = validateMetadataEvent(event);
  setState((prev) => ({
    ...prev,
    phase: "metadata",
    metadata,
    duration: metadata.duration ?? null,
  }));
}

function handleTriageEvent(event: Record<string, unknown>, setState: SetState): void {
  const contentTags = Array.isArray(event.contentTags)
    ? event.contentTags.filter(isValidContentTag)
    : [];
  const modifiers = Array.isArray(event.modifiers)
    ? event.modifiers.filter(isValidModifier)
    : [];
  const primaryTag = (typeof event.primaryTag === "string" ? event.primaryTag : "learning") as ContentTag;
  const confidence = typeof event.confidence === "number" ? event.confidence : 0;
  const userGoal = typeof event.userGoal === "string" ? event.userGoal : "";
  const tabs = Array.isArray(event.tabs)
    ? event.tabs.filter(isValidTabDefinition)
    : [];

  setState((prev) => ({
    ...prev,
    phase: "extraction",
    triage: { contentTags, modifiers, primaryTag, userGoal, tabs, confidence },
  }));
}

function handleExtractionProgress(event: Record<string, unknown>, setState: SetState): void {
  const section = typeof event.section === "string" ? event.section : "";
  const percent = typeof event.percent === "number" ? event.percent : 0;
  setState((prev) => ({
    ...prev,
    phase: "extraction",
    extractionProgress: { section, percent },
  }));
}

function handleExtractionComplete(event: Record<string, unknown>, setState: SetState): void {
  const data = (typeof event.data === "object" && event.data !== null)
    ? event.data as Record<string, unknown>
    : {};
  setState((prev) => ({
    ...prev,
    domainData: { ...(prev.domainData ?? {}), ...data },
  }));
}

function handleEnrichmentComplete(event: Record<string, unknown>, setState: SetState): void {
  const enrichment: EnrichmentData = {};
  if (Array.isArray(event.quiz)) {
    enrichment.quiz = event.quiz.filter(
      (q): q is QuizQuestion => !!q && typeof q === 'object' && 'question' in q && Array.isArray((q as Record<string, unknown>).options)
    );
  }
  if (Array.isArray(event.flashcards)) {
    enrichment.flashcards = event.flashcards.filter(
      (f): f is Flashcard => !!f && typeof f === 'object' && 'front' in f && 'back' in f
    );
  }
  if (Array.isArray(event.cheatSheet)) {
    enrichment.cheatSheet = event.cheatSheet.filter(
      (c): c is CodeCheatSheetItem => !!c && typeof c === 'object' && 'title' in c
    );
  }
  if (Array.isArray(event.scenarios)) {
    enrichment.scenarios = event.scenarios.filter(
      (s): s is ScenarioItem => !!s && typeof s === 'object' && 'scenario' in s
    );
  }
  setState((prev) => ({ ...prev, enrichment }));
}

function handleSynthesisComplete(event: Record<string, unknown>, setState: SetState): void {
  const { tldr, keyTakeaways } = validateSynthesisComplete(event);
  const masterSummary = typeof event.masterSummary === "string" ? event.masterSummary : "";
  const seoDescription = typeof event.seoDescription === "string" ? event.seoDescription : "";
  setState((prev) => ({
    ...prev,
    synthesis: { tldr, keyTakeaways, masterSummary, seoDescription },
  }));
}

function handleDoneEvent(event: Record<string, unknown>, setState: SetState): void {
  const processingTimeMs = validateDoneEvent(event);
  setState((prev) => ({
    ...prev,
    phase: "done",
    processingTimeMs,
    confettiCount: prev.isCached ? prev.confettiCount : prev.confettiCount + 1,
  }));
}

function handleErrorEvent(event: Record<string, unknown>, setState: SetState): void {
  const { message, code } = validateErrorEvent(event);
  const userFriendlyError = getUserFriendlyError(message, code);
  setState((prev) => ({
    ...prev,
    phase: "error",
    error: userFriendlyError,
  }));
}

function handleMetaEvent(event: Record<string, unknown>, setState: SetState): void {
  const meta: VIEResponseMeta = {
    videoId: typeof event.videoId === "string" ? event.videoId : "",
    videoTitle: typeof event.title === "string" ? event.title : "",
    creator: typeof event.creator === "string" ? event.creator : "",
    contentTags: Array.isArray(event.contentTags) ? event.contentTags.filter(isValidContentTag) : [],
    modifiers: Array.isArray(event.modifiers) ? event.modifiers.filter(isValidModifier) : [],
    primaryTag: (typeof event.primaryTag === "string" ? event.primaryTag : "learning") as ContentTag,
    userGoal: typeof event.userGoal === "string" ? event.userGoal : "",
    language: typeof event.language === "string" ? event.language : undefined,
    isRTL: typeof event.isRTL === "boolean" ? event.isRTL : undefined,
  };
  const tabCount = typeof event.tabCount === "number" ? event.tabCount : 0;
  const tabLabels = Array.isArray(event.tabLabels)
    ? event.tabLabels.filter(isValidTabLabel)
    : [];
  setState((prev) => ({ ...prev, meta, tabs: [], tabCount, tabLabels }));
}

/** Strip React-specific dangerous keys from SSE props to prevent injection. */
function sanitizeTabProps(raw: Record<string, unknown>): Record<string, unknown> {
  const { dangerouslySetInnerHTML, __html, ...safe } = raw;
  return safe;
}

function handleTabReady(event: Record<string, unknown>, setState: SetState): void {
  const rawProps = (typeof event.props === "object" && event.props !== null) ? event.props as Record<string, unknown> : {};
  const tab: TabEntry = {
    id: typeof event.id === "string" ? event.id : "",
    label: typeof event.label === "string" ? event.label : "",
    emoji: typeof event.emoji === "string" ? event.emoji : "",
    component: typeof event.component === "string" ? event.component : "",
    props: sanitizeTabProps(rawProps),
    crossTabLinks: Array.isArray(event.crossTabLinks)
      ? event.crossTabLinks.filter(isValidCrossTabLink)
      : undefined,
  };
  setState((prev) => {
    const existingIdx = prev.tabs.findIndex(t => t.id === tab.id);
    if (existingIdx >= 0) {
      const updated = [...prev.tabs];
      updated[existingIdx] = tab;
      return { ...prev, tabs: updated };
    }
    return { ...prev, tabs: [...prev.tabs, tab] };
  });
}

function handleCompleteEvent(event: Record<string, unknown>, setState: SetState): void {
  const processingTimeMs = typeof event.processingTimeMs === "number" ? event.processingTimeMs : null;
  setState((prev) => ({ ...prev, processingTimeMs }));
}

function handleFramesEvent(event: Record<string, unknown>, setState: SetState): void {
  const rawFrames = Array.isArray(event.frames) ? event.frames : [];
  const frames: FrameInfo[] = rawFrames
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => ({
    index: typeof f.index === "number" ? f.index : 0,
    timestamp: typeof f.timestamp === "number" ? f.timestamp : 0,
    url: typeof f.url === "string" ? f.url : "",
    s3Key: typeof f.s3Key === "string" ? f.s3Key : undefined,
    ocrText: typeof f.ocrText === "string" ? f.ocrText : undefined,
    textDensity: typeof f.textDensity === "number" ? f.textDensity : undefined,
  }));
  setState((prev) => ({ ...prev, frames }));
}

function handleWarningEvent(event: Record<string, unknown>, setState: SetState): void {
  const message = typeof event.message === "string"
    ? event.message
    : "Some operations completed with warnings";
  const rawTasks = event.failedTasks;
  const failedTasks = Array.isArray(rawTasks)
    ? rawTasks.filter((t): t is string => typeof t === "string")
    : [];
  const warningText = failedTasks.length > 0
    ? `${message} (failed: ${failedTasks.join(", ")})`
    : message;
  setState((prev) => ({
    ...prev,
    warnings: [...prev.warnings, warningText],
  }));
}

// ─── Event dispatch table ───

const EVENT_HANDLERS: Record<string, (event: Record<string, unknown>, setState: SetState) => void> = {
  cached: (_, setState) => setState((prev) => ({ ...prev, isCached: true })),
  phase: handlePhaseEvent,
  metadata: handleMetadataEvent,
  triage_complete: handleTriageEvent,
  intent_detected: handleTriageEvent,
  extraction_progress: handleExtractionProgress,
  extraction_complete: handleExtractionComplete,
  enrichment_complete: handleEnrichmentComplete,
  synthesis_complete: handleSynthesisComplete,
  done: handleDoneEvent,
  error: handleErrorEvent,
  meta: handleMetaEvent,
  tab_ready: handleTabReady,
  complete: handleCompleteEvent,
  frames: handleFramesEvent,
  warning: handleWarningEvent,
};

// ─── Main entry point ───

export function processEvent(
  event: Record<string, unknown>,
  setState: SetState,
): void {
  const eventType = typeof event.event === 'string' ? event.event : null;
  if (!eventType) {
    if (import.meta.env.DEV) console.warn('[processEvent] Missing or non-string event type', event);
    return;
  }

  const handler = EVENT_HANDLERS[eventType];
  if (handler) {
    handler(event, setState);
  }
}
