/**
 * SSE Event Validators - Runtime validation for streaming events.
 *
 * Issue #11: Validates SSE event data before type casting to prevent
 * runtime errors from malformed server responses.
 */

import { z } from 'zod';
import { sseLogger } from './sse-logger';
import {
  VIDEO_CATEGORY_VALUES,
  type DescriptionLink,
  type Resource,
  type RelatedVideo,
  type SocialLink,
  type VideoContext,
} from '@vie/types';

// ─────────────────────────────────────────────────────
// Zod Schemas
// ─────────────────────────────────────────────────────

export const descriptionLinkSchema = z.object({
  url: z.string(),
  type: z.string(),
  label: z.string(),
});

export const resourceSchema = z.object({
  name: z.string(),
  url: z.string(),
});

export const relatedVideoSchema = z.object({
  title: z.string(),
  url: z.string(),
});

export const socialLinkSchema = z.object({
  platform: z.string(),
  url: z.string(),
});

// ─────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────

/**
 * Validate description analysis from SSE event.
 */
export function validateDescriptionAnalysis(data: unknown): {
  links: DescriptionLink[];
  resources: Resource[];
  relatedVideos: RelatedVideo[];
  socialLinks: SocialLink[];
} | null {
  const schema = z.object({
    links: z.array(descriptionLinkSchema).default([]),
    resources: z.array(resourceSchema).default([]),
    relatedVideos: z.array(relatedVideoSchema).default([]),
    socialLinks: z.array(socialLinkSchema).default([]),
  });

  const result = schema.safeParse(data);
  if (!result.success) {
    sseLogger.warn('Invalid description analysis:', result.error.message);
    return null;
  }
  return result.data as {
    links: DescriptionLink[];
    resources: Resource[];
    relatedVideos: RelatedVideo[];
    socialLinks: SocialLink[];
  };
}

// ─────────────────────────────────────────────────────
// Event-Level Validators (for full SSE event objects)
// ─────────────────────────────────────────────────────

// Video context schema for category-based rendering
export const videoContextSchema = z.object({
  category: z.enum(VIDEO_CATEGORY_VALUES),
  youtubeCategory: z.string(),
  tags: z.array(z.string()),
  displayTags: z.array(z.string()),
});

interface VideoMetadata {
  title?: string;
  channel?: string;
  thumbnailUrl?: string;
  duration?: number;
  context?: VideoContext;
}

const metadataEventSchema = z.object({
  event: z.literal('metadata'),
  title: z.string().optional(),
  channel: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  duration: z.number().optional(),
  context: videoContextSchema.optional(),
});

/**
 * Validate metadata event from SSE.
 * Returns validated metadata or default values if validation fails.
 */
export function validateMetadataEvent(data: unknown): VideoMetadata {
  const result = metadataEventSchema.safeParse(data);
  if (!result.success) {
    sseLogger.warn('Invalid metadata event:', result.error.message);
    return {};
  }
  return {
    title: result.data.title,
    channel: result.data.channel,
    thumbnailUrl: result.data.thumbnailUrl,
    duration: result.data.duration,
    context: result.data.context as VideoContext | undefined,
  };
}

const synthesisCompleteEventSchema = z.object({
  event: z.literal('synthesis_complete'),
  tldr: z.string().default(''),
  keyTakeaways: z.array(z.string()).default([]),
});

interface SynthesisResult {
  tldr: string;
  keyTakeaways: string[];
}

/**
 * Validate synthesis_complete event from SSE.
 * Returns validated synthesis data or defaults if validation fails.
 */
export function validateSynthesisComplete(data: unknown): SynthesisResult {
  const result = synthesisCompleteEventSchema.safeParse(data);
  if (!result.success) {
    sseLogger.warn('Invalid synthesis_complete event:', result.error.message);
    return { tldr: '', keyTakeaways: [] };
  }
  return {
    tldr: result.data.tldr,
    keyTakeaways: result.data.keyTakeaways,
  };
}

const doneEventSchema = z.object({
  event: z.literal('done'),
  processingTimeMs: z.number().nullable().optional(),
});

/**
 * Validate done event from SSE.
 * Returns processing time or null if validation fails.
 */
export function validateDoneEvent(data: unknown): number | null {
  const result = doneEventSchema.safeParse(data);
  if (!result.success) {
    sseLogger.warn('Invalid done event:', result.error.message);
    return null;
  }
  return result.data.processingTimeMs ?? null;
}

const errorEventSchema = z.object({
  event: z.literal('error'),
  message: z.string().default('Unknown error'),
  code: z.string().optional(),
});

interface ErrorEventResult {
  message: string;
  code?: string;
}

/**
 * Validate error event from SSE.
 * Returns error details with defaults if validation fails.
 */
export function validateErrorEvent(data: unknown): ErrorEventResult {
  const result = errorEventSchema.safeParse(data);
  if (!result.success) {
    sseLogger.warn('Invalid error event:', result.error.message);
    return { message: 'Unknown error' };
  }
  return {
    message: result.data.message,
    code: result.data.code,
  };
}

// ─────────────────────────────────────────────────────
// Phase Event Validation
// ─────────────────────────────────────────────────────

/**
 * Valid stream phases for SSE streaming.
 * These come from the backend and represent processing stages.
 */
const VALID_SSE_PHASES = [
  'metadata',
  'transcript',
  'triage',
  'extraction',
  'enrichment',
  'synthesis',
] as const;

type SSEPhase = typeof VALID_SSE_PHASES[number];

const phaseEventSchema = z.object({
  event: z.literal('phase'),
  phase: z.enum(VALID_SSE_PHASES),
});

/**
 * Validate a phase event from SSE stream.
 * Returns the validated phase or null if invalid.
 */
export function validatePhaseEvent(data: unknown): SSEPhase | null {
  const result = phaseEventSchema.safeParse(data);
  if (!result.success) {
    sseLogger.warn('Invalid phase event:', result.error.message);
    return null;
  }
  return result.data.phase;
}
