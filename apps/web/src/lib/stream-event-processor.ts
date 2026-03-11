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
} from "@/lib/sse-validators";
import { getUserFriendlyError } from "@/lib/stream-error-messages";
import type { StreamState } from "@/hooks/use-summary-stream";
import type { ContentTag, TabDefinition, EnrichmentData, QuizQuestion, Flashcard, CodeCheatSheetItem, ScenarioItem, Modifier } from "@vie/types";

export function processEvent(
  event: Record<string, unknown>,
  setState: Dispatch<SetStateAction<StreamState>>,
): void {
  const eventType = event.event as string;

  switch (eventType) {
    case "cached":
      setState((prev) => ({ ...prev, isCached: true }));
      break;

    case "phase": {
      const phase = validatePhaseEvent(event);
      if (phase) {
        setState((prev) => ({ ...prev, phase: phase as StreamState["phase"] }));
      }
      break;
    }

    case "metadata": {
      const metadata = validateMetadataEvent(event);
      setState((prev) => ({
        ...prev,
        phase: "metadata",
        metadata,
        duration: metadata.duration ?? null,
      }));
      break;
    }

    // ─── Triage Pipeline Events ───

    case "triage_complete":
    case "intent_detected": {
      // Handle both new triage_complete and legacy intent_detected
      const contentTags = Array.isArray(event.contentTags)
        ? (event.contentTags as ContentTag[])
        : [];
      const modifiers = Array.isArray(event.modifiers)
        ? (event.modifiers as Modifier[])
        : [];
      const primaryTag = (typeof event.primaryTag === "string" ? event.primaryTag : "learning") as ContentTag;
      const confidence = typeof event.confidence === "number" ? event.confidence : 0;
      const userGoal = typeof event.userGoal === "string" ? event.userGoal : "";
      const tabs = Array.isArray(event.tabs)
        ? (event.tabs as TabDefinition[])
        : [];

      setState((prev) => ({
        ...prev,
        phase: "extraction",
        triage: { contentTags, modifiers, primaryTag, userGoal, tabs, confidence },
      }));
      break;
    }

    case "extraction_progress": {
      const section = typeof event.section === "string" ? event.section : "";
      const percent = typeof event.percent === "number" ? event.percent : 0;
      setState((prev) => ({
        ...prev,
        phase: "extraction",
        extractionProgress: { section, percent },
      }));
      break;
    }

    case "extraction_complete": {
      // Domain-keyed data: { data: { learning: {...}, tech: {...} } }
      const data = (typeof event.data === "object" && event.data !== null)
        ? event.data as Record<string, unknown>
        : {};
      setState((prev) => ({
        ...prev,
        domainData: { ...(prev.domainData ?? {}), ...data },
      }));
      break;
    }

    case "enrichment_complete": {
      const enrichment: EnrichmentData = {};
      if (Array.isArray(event.quiz)) enrichment.quiz = event.quiz as QuizQuestion[];
      if (Array.isArray(event.flashcards)) enrichment.flashcards = event.flashcards as Flashcard[];
      if (Array.isArray(event.cheatSheet)) enrichment.cheatSheet = event.cheatSheet as CodeCheatSheetItem[];
      if (Array.isArray(event.scenarios)) enrichment.scenarios = event.scenarios as ScenarioItem[];
      setState((prev) => ({
        ...prev,
        enrichment,
      }));
      break;
    }

    case "synthesis_complete": {
      const { tldr, keyTakeaways } = validateSynthesisComplete(event);
      const masterSummary = typeof event.masterSummary === "string" ? event.masterSummary : "";
      const seoDescription = typeof event.seoDescription === "string" ? event.seoDescription : "";
      setState((prev) => ({
        ...prev,
        synthesis: { tldr, keyTakeaways, masterSummary, seoDescription },
      }));
      break;
    }

    case "done": {
      const processingTimeMs = validateDoneEvent(event);
      setState((prev) => ({
        ...prev,
        phase: "done",
        processingTimeMs,
        confettiCount: prev.isCached ? prev.confettiCount : prev.confettiCount + 1,
      }));
      break;
    }

    case "error": {
      const { message, code } = validateErrorEvent(event);
      const userFriendlyError = getUserFriendlyError(message, code);
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: userFriendlyError,
      }));
      break;
    }

    case "warning": {
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
      break;
    }
  }
}
