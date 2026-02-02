/**
 * SSE Event Validators - Runtime validation for streaming events.
 *
 * Issue #11: Validates SSE event data before type casting to prevent
 * runtime errors from malformed server responses.
 */

import { z } from 'zod';
import { sseLogger } from './sse-logger';
import type {
  Chapter,
  Section,
  Concept,
  ContentBlock,
  DescriptionLink,
  Resource,
  RelatedVideo,
  DescriptionTimestamp,
  SocialLink,
  VideoContext,
} from '@vie/types';

// ─────────────────────────────────────────────────────
// Zod Schemas
// ─────────────────────────────────────────────────────

export const chapterSchema = z.object({
  startSeconds: z.number(),
  endSeconds: z.number(),
  title: z.string(),
});

// Content block schemas for dynamic section content
export const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), variant: z.string().optional(), text: z.string() }),
  z.object({ type: z.literal('bullets'), variant: z.string().optional(), items: z.array(z.string()) }),
  z.object({ type: z.literal('numbered'), variant: z.string().optional(), items: z.array(z.string()) }),
  z.object({ type: z.literal('do_dont'), do: z.array(z.string()), dont: z.array(z.string()) }),
  z.object({ type: z.literal('example'), variant: z.string().optional(), title: z.string().optional(), code: z.string(), explanation: z.string().optional() }),
  z.object({ type: z.literal('callout'), variant: z.string().optional(), style: z.enum(['tip', 'warning', 'note', 'chef_tip', 'security']), text: z.string() }),
  z.object({ type: z.literal('definition'), variant: z.string().optional(), term: z.string(), meaning: z.string() }),
  // Block types for video context enhancement
  z.object({ type: z.literal('keyvalue'), variant: z.string().optional(), items: z.array(z.object({ key: z.string(), value: z.string() })) }),
  z.object({ type: z.literal('comparison'), variant: z.string().optional(), left: z.object({ label: z.string(), items: z.array(z.string()) }), right: z.object({ label: z.string(), items: z.array(z.string()) }) }),
  z.object({ type: z.literal('timestamp'), time: z.string(), seconds: z.number(), label: z.string() }),
  // Quote block for speaker quotes and testimonials
  z.object({
    type: z.literal('quote'),
    variant: z.enum(['speaker', 'testimonial', 'highlight']).optional(),
    text: z.string(),
    attribution: z.string().optional(),
    timestamp: z.number().optional(),
  }),
  // Statistic block for metrics and data points
  z.object({
    type: z.literal('statistic'),
    variant: z.enum(['metric', 'percentage', 'trend']).optional(),
    items: z.array(z.object({
      value: z.string(),
      label: z.string(),
      context: z.string().optional(),
      trend: z.enum(['up', 'down', 'neutral']).optional(),
    })),
  }),
]);

export const sectionSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  startSeconds: z.number().optional(),
  start_seconds: z.number().optional(),  // Backend compatibility
  endSeconds: z.number().optional(),
  end_seconds: z.number().optional(),    // Backend compatibility
  title: z.string(),
  originalTitle: z.string().optional(),
  original_title: z.string().optional(), // Backend compatibility
  generatedTitle: z.string().optional().nullable(),
  generated_title: z.string().optional().nullable(), // Backend compatibility
  isCreatorChapter: z.boolean().optional(),
  is_creator_chapter: z.boolean().optional(), // Backend compatibility
  // Content blocks use z.any() here to allow partial success - individual blocks
  // are validated by validateContentBlocks() in validateSection(), which filters
  // out invalid blocks while keeping valid ones (graceful degradation).
  content: z.array(z.any()).optional(),
  summary: z.string(),
  bullets: z.array(z.string()),
});

export const conceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  definition: z.string().nullable().optional(),
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
    sseLogger.warn('Invalid chapters data:', result.error.message);
    return [];
  }
  return result.data as Chapter[];
}

/**
 * Validate and filter content blocks, returning only valid blocks.
 * Invalid blocks are logged and filtered out rather than failing validation.
 */
function validateContentBlocks(blocks: unknown[] | undefined): ContentBlock[] | undefined {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return undefined;
  }

  const validBlocks: ContentBlock[] = [];
  for (const block of blocks) {
    const result = contentBlockSchema.safeParse(block);
    if (result.success) {
      validBlocks.push(result.data as ContentBlock);
    } else {
      sseLogger.warn('Invalid content block filtered out:', result.error.message);
    }
  }

  return validBlocks.length > 0 ? validBlocks : undefined;
}

/**
 * Validate section from SSE event.
 * Returns null if validation fails.
 * Normalizes snake_case to camelCase for backend compatibility.
 */
export function validateSection(data: unknown): Section | null {
  const result = sectionSchema.safeParse(data);
  if (!result.success) {
    sseLogger.warn('Invalid section data:', result.error.message);
    return null;
  }
  const d = result.data;
  // Normalize snake_case to camelCase
  return {
    id: d.id,
    timestamp: d.timestamp,
    startSeconds: d.startSeconds ?? d.start_seconds ?? 0,
    endSeconds: d.endSeconds ?? d.end_seconds ?? 0,
    title: d.title,
    originalTitle: d.originalTitle ?? d.original_title,
    generatedTitle: d.generatedTitle ?? d.generated_title ?? undefined,
    isCreatorChapter: d.isCreatorChapter ?? d.is_creator_chapter,
    content: validateContentBlocks(d.content), // Validated dynamic content blocks
    summary: d.summary,
    bullets: d.bullets,
  };
}

/**
 * Validate concepts array from SSE event.
 * Returns empty array if validation fails.
 */
export function validateConcepts(data: unknown): Concept[] {
  const result = z.array(conceptSchema).safeParse(data);
  if (!result.success) {
    sseLogger.warn('Invalid concepts data:', result.error.message);
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
    sseLogger.warn('Invalid description analysis:', result.error.message);
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

// Video context schema for persona-aware rendering
export const videoContextSchema = z.object({
  youtubeCategory: z.string(),
  persona: z.enum(['code', 'recipe', 'standard', 'interview', 'review']),
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
    // Zod schema already validates and types the context correctly
    context: result.data.context,
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
    sseLogger.warn('Invalid chapters event:', result.error.message);
    return { chapters: [], isCreatorChapters: false };
  }
  return {
    chapters: result.data.chapters as Chapter[],
    isCreatorChapters: result.data.isCreatorChapters,
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
  'parallel_analysis',
  'section_detect',
  'section_summaries',
  'concepts',
  'master_summary',
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
