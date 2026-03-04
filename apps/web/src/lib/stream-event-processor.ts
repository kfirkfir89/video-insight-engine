/**
 * SSE event processor for video summarization stream.
 * Maps incoming events to StreamState updates.
 */

import type { Dispatch, SetStateAction, RefObject } from "react";
import {
  validateChapter,
  validateConcepts,
  validateDescriptionAnalysis,
  validateMetadataEvent,
  validateChaptersEvent,
  validateSynthesisComplete,
  validateDoneEvent,
  validateErrorEvent,
  validatePhaseEvent,
} from "@/lib/sse-validators";
import { getUserFriendlyError } from "@/lib/stream-error-messages";
import type { StreamState } from "@/hooks/use-summary-stream";
import type { OutputType } from "@vie/types";

export function processEvent(
  event: Record<string, unknown>,
  setState: Dispatch<SetStateAction<StreamState>>,
  streamingTextRef: RefObject<string>,
  scheduleTokenUpdate: (phase: string, text: string, index: number) => void,
  flushTokenUpdate: () => void
): void {
  const eventType = event.event as string;

  switch (eventType) {
    case "cached":
      setState((prev) => ({ ...prev, isCached: true }));
      break;

    case "phase": {
      const phase = validatePhaseEvent(event);
      if (phase) {
        streamingTextRef.current = "";
        setState((prev) => ({ ...prev, phase }));
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

    case "chapters": {
      const { chapters: detected, isCreatorChapters } = validateChaptersEvent(event);
      setState((prev) => ({
        ...prev,
        detectedChapters: detected,
        isCreatorChapters,
      }));
      break;
    }

    case "description_analysis": {
      const analysis = validateDescriptionAnalysis(event);
      if (analysis) {
        setState((prev) => ({
          ...prev,
          descriptionAnalysis: analysis,
        }));
      }
      break;
    }

    case "transcript_ready": {
      const duration = typeof event.duration === "number" ? event.duration : null;
      setState((prev) => ({
        ...prev,
        phase: "transcript",
        duration,
      }));
      break;
    }

    case "token": {
      if (typeof event.phase !== "string" || typeof event.token !== "string") break;
      const phase = event.phase;
      const token = event.token;
      const index = typeof event.index === "number" ? event.index : 0;
      streamingTextRef.current += token;
      const currentText = streamingTextRef.current;
      scheduleTokenUpdate(phase, currentText, index);
      break;
    }

    case "sections_detected":
    case "chapters_detected":
      setState((prev) => ({ ...prev, phase: "chapter_summaries" }));
      break;

    case "chapter_start": {
      flushTokenUpdate();
      streamingTextRef.current = "";
      const chapterIndex = typeof event.index === "number" ? event.index : 0;
      setState((prev) => ({
        ...prev,
        currentChapterIndex: chapterIndex,
        currentChapterText: "",
      }));
      break;
    }

    case "chapter_complete": {
      flushTokenUpdate();
      const chapter = validateChapter(event.chapter);
      if (!chapter) break;
      streamingTextRef.current = "";
      setState((prev) => ({
        ...prev,
        chapters: [...prev.chapters, chapter],
        currentChapterText: "",
        currentChapterIndex: -1,
      }));
      break;
    }

    case "chapter_ready": {
      flushTokenUpdate();
      const index = typeof event.index === "number" ? event.index : 0;
      const chapter = validateChapter(event.chapter);
      if (!chapter) break;
      streamingTextRef.current = "";
      setState((prev) => {
        const newChapters = [...prev.chapters];
        const insertAt = newChapters.findIndex(
          (c) => c.startSeconds > chapter.startSeconds
        );
        if (insertAt === -1) {
          newChapters.push(chapter);
        } else {
          newChapters.splice(insertAt, 0, chapter);
        }
        const newStatuses = { ...prev.chapterStatuses, [index]: "completed" as const };
        return {
          ...prev,
          chapters: newChapters,
          chapterStatuses: newStatuses,
          currentChapterText: "",
          currentChapterIndex: -1,
        };
      });
      break;
    }

    case "concepts_complete": {
      const concepts = validateConcepts(event.concepts);
      streamingTextRef.current = "";
      setState((prev) => ({ ...prev, concepts }));
      break;
    }

    case "master_summary_complete": {
      const masterSummary =
        typeof event.masterSummary === "string" ? event.masterSummary : null;
      setState((prev) => ({ ...prev, masterSummary }));
      break;
    }

    case "synthesis_complete": {
      flushTokenUpdate();
      const { tldr, keyTakeaways } = validateSynthesisComplete(event);
      setState((prev) => ({ ...prev, tldr, keyTakeaways }));
      break;
    }

    case "detection_result": {
      const detectedType = (
        typeof event.detected_type === "string"
          ? event.detected_type
          : "summary"
      ) as OutputType;
      const confidence =
        typeof event.confidence === "number" ? event.confidence : 0;
      const alternatives = Array.isArray(event.alternatives)
        ? (event.alternatives as Array<Record<string, unknown>>).filter(
            (a): a is { type: string; confidence: number } =>
              typeof a.type === "string" && typeof a.confidence === "number"
          )
        : [];
      setState((prev) => ({
        ...prev,
        detectionResult: { detectedType, confidence, alternatives },
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
