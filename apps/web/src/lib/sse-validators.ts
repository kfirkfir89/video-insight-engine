/**
 * SSE Event Validators - Runtime validation for streaming events.
 *
 * Issue #11: Validates SSE event data before type casting to prevent
 * runtime errors from malformed server responses.
 */

import { z } from 'zod';
import type {
  Chapter,
  Section,
  Concept,
  DescriptionLink,
  Resource,
  RelatedVideo,
  DescriptionTimestamp,
  SocialLink,
} from '@vie/types';

// ─────────────────────────────────────────────────────
// Zod Schemas
// ─────────────────────────────────────────────────────

export const chapterSchema = z.object({
  startSeconds: z.number(),
  endSeconds: z.number(),
  title: z.string(),
});

export const sectionSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  startSeconds: z.number(),
  endSeconds: z.number(),
  title: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()),
});

export const conceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  definition: z.string().optional(),
  timestamp: z.string().nullable().optional(),
});

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

export const timestampSchema = z.object({
  time: z.string(),
  label: z.string(),
});

export const socialLinkSchema = z.object({
  platform: z.string(),
  url: z.string(),
});

// ─────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────

/**
 * Validate chapters array from SSE event.
 * Returns empty array if validation fails.
 */
export function validateChapters(data: unknown): Chapter[] {
  const result = z.array(chapterSchema).safeParse(data);
  if (!result.success) {
    console.warn('[SSE] Invalid chapters data:', result.error.message);
    return [];
  }
  return result.data as Chapter[];
}

/**
 * Validate section from SSE event.
 * Returns null if validation fails.
 */
export function validateSection(data: unknown): Section | null {
  const result = sectionSchema.safeParse(data);
  if (!result.success) {
    console.warn('[SSE] Invalid section data:', result.error.message);
    return null;
  }
  return result.data as Section;
}

/**
 * Validate concepts array from SSE event.
 * Returns empty array if validation fails.
 */
export function validateConcepts(data: unknown): Concept[] {
  const result = z.array(conceptSchema).safeParse(data);
  if (!result.success) {
    console.warn('[SSE] Invalid concepts data:', result.error.message);
    return [];
  }
  return result.data.map(c => ({
    ...c,
    definition: c.definition ?? null,
    timestamp: c.timestamp ?? null,
  })) as Concept[];
}

/**
 * Validate description analysis from SSE event.
 */
export function validateDescriptionAnalysis(data: unknown): {
  links: DescriptionLink[];
  resources: Resource[];
  relatedVideos: RelatedVideo[];
  timestamps: DescriptionTimestamp[];
  socialLinks: SocialLink[];
} | null {
  const schema = z.object({
    links: z.array(descriptionLinkSchema).default([]),
    resources: z.array(resourceSchema).default([]),
    relatedVideos: z.array(relatedVideoSchema).default([]),
    timestamps: z.array(timestampSchema).default([]),
    socialLinks: z.array(socialLinkSchema).default([]),
  });

  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn('[SSE] Invalid description analysis:', result.error.message);
    return null;
  }
  // Cast to expected type - Zod validates structure, runtime handles flexible string types
  return result.data as {
    links: DescriptionLink[];
    resources: Resource[];
    relatedVideos: RelatedVideo[];
    timestamps: DescriptionTimestamp[];
    socialLinks: SocialLink[];
  };
}

// ─────────────────────────────────────────────────────
// Event-Level Validators (for full SSE event objects)
// ─────────────────────────────────────────────────────

interface VideoMetadata {
  title?: string;
  channel?: string;
  thumbnailUrl?: string;
  duration?: number;
}

const metadataEventSchema = z.object({
  event: z.literal('metadata'),
  title: z.string().optional(),
  channel: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  duration: z.number().optional(),
});

/**
 * Validate metadata event from SSE.
 * Returns validated metadata or default values if validation fails.
 */
export function validateMetadataEvent(data: unknown): VideoMetadata {
  const result = metadataEventSchema.safeParse(data);
  if (!result.success) {
    console.warn('[SSE] Invalid metadata event:', result.error.message);
    return {};
  }
  return {
    title: result.data.title,
    channel: result.data.channel,
    thumbnailUrl: result.data.thumbnailUrl,
    duration: result.data.duration,
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
    console.warn('[SSE] Invalid synthesis_complete event:', result.error.message);
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
    console.warn('[SSE] Invalid done event:', result.error.message);
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
    console.warn('[SSE] Invalid error event:', result.error.message);
    return { message: 'Unknown error' };
  }
  return {
    message: result.data.message,
    code: result.data.code,
  };
}

const chaptersEventSchema = z.object({
  event: z.literal('chapters'),
  chapters: z.array(chapterSchema),
  isCreatorChapters: z.boolean().default(false),
});

interface ChaptersEventResult {
  chapters: Chapter[];
  isCreatorChapters: boolean;
}

/**
 * Validate chapters event from SSE.
 * Returns validated chapters with metadata or defaults.
 */
export function validateChaptersEvent(data: unknown): ChaptersEventResult {
  const result = chaptersEventSchema.safeParse(data);
  if (!result.success) {
    console.warn('[SSE] Invalid chapters event:', result.error.message);
    return { chapters: [], isCreatorChapters: false };
  }
  return {
    chapters: result.data.chapters as Chapter[],
    isCreatorChapters: result.data.isCreatorChapters,
  };
}
