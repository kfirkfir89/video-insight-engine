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
import type { OutputType, OutputSection, OutputData, EnrichmentData, QuizQuestion, Flashcard, CodeCheatSheetItem } from "@vie/types";

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
        // Cast validated phase to StreamState phase (sse-validators may return legacy phases)
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

    // ─── Pipeline Output Events ───

    case "intent_detected": {
      const outputType = (typeof event.outputType === "string" ? event.outputType : "explanation") as OutputType;
      const confidence = typeof event.confidence === "number" ? event.confidence : 0;
      const userGoal = typeof event.userGoal === "string" ? event.userGoal : "";
      const sections = Array.isArray(event.sections)
        ? (event.sections as OutputSection[])
        : [];
      setState((prev) => ({
        ...prev,
        phase: "extraction",
        intent: { outputType, confidence, userGoal, sections },
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
      const extractedType = (typeof event.outputType === "string" ? event.outputType : "explanation") as OutputType;
      const data = event.data as OutputData["data"];
      setState((prev) => ({
        ...prev,
        output: {
          type: extractedType,
          data,
        } as OutputData,
      }));
      break;
    }

    case "enrichment_complete": {
      const enrichment: EnrichmentData = {};
      if (Array.isArray(event.quiz)) enrichment.quiz = event.quiz as QuizQuestion[];
      if (Array.isArray(event.flashcards)) enrichment.flashcards = event.flashcards as Flashcard[];
      if (Array.isArray(event.cheatSheet)) enrichment.cheatSheet = event.cheatSheet as CodeCheatSheetItem[];
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
