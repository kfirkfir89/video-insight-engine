// ═══════════════════════════════════════════════════
// Common Types — Status, Transcript, Generation
// ═══════════════════════════════════════════════════

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type TranscriptSource = 'ytdlp' | 'api' | 'proxy' | 'whisper' | 'gemini' | 'metadata';

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * Full transcript stored in S3 for regeneration without re-fetching from YouTube.
 * S3 key format: `videos/{youtubeId}/transcript.json`
 */
export interface RawTranscript {
  youtubeId: string;
  fetchedAt: string;           // ISO date
  source: TranscriptSource;
  language: string | null;
  segments: TranscriptSegment[];
}

/**
 * Generation metadata for tracking prompt versions and enabling regeneration.
 * Stored with each summary to know what model/prompt produced it.
 */
export interface GenerationMetadata {
  model: string;               // e.g., "anthropic/claude-sonnet-4-20250514"
  promptVersion: string;       // e.g., "v2.3"
  generatedAt: string;         // ISO date
}

export type FolderType = 'summarized' | 'memorized';

export type SourceType =
  | 'video_section'
  | 'video_concept'
  | 'system_expansion';

export type TargetType = 'section' | 'concept';
