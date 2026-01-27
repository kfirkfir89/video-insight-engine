// ═══════════════════════════════════════════════════
// VIDEO INSIGHT ENGINE - Shared Types
// ═══════════════════════════════════════════════════

// ─────────────────────────────────────────────────────
// Status Types
// ─────────────────────────────────────────────────────

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

// ─────────────────────────────────────────────────────
// Transcript Types (Phase 2 & 3)
// ─────────────────────────────────────────────────────

export type TranscriptSource = 'ytdlp' | 'api' | 'proxy' | 'whisper';

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export type FolderType = 'summarized' | 'memorized';

export type SourceType =
  | 'video_section'
  | 'video_concept'
  | 'system_expansion';

export type TargetType = 'section' | 'concept';

// ─────────────────────────────────────────────────────
// Video Context Types
// ─────────────────────────────────────────────────────

export type VideoPersona = 'code' | 'recipe' | 'standard' | 'interview' | 'review';

export interface VideoContext {
  youtubeCategory: string;
  persona: VideoPersona;
  tags: string[];
  displayTags: string[];
}

// ─────────────────────────────────────────────────────
// Video Summary Types
// ─────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────
// Content Block Types (Dynamic Section Content)
// ─────────────────────────────────────────────────────

export interface ParagraphBlock {
  type: 'paragraph';
  variant?: string;
  text: string;
}

export interface BulletsBlock {
  type: 'bullets';
  variant?: 'ingredients' | 'checklist' | string;
  items: string[];
}

export interface NumberedBlock {
  type: 'numbered';
  variant?: 'cooking_steps' | string;
  items: string[];
}

export interface DoDoNotBlock {
  type: 'do_dont';
  do: string[];
  dont: string[];
}

export interface ExampleBlock {
  type: 'example';
  variant?: 'terminal_command' | string;
  title?: string;
  code: string;
  explanation?: string;
}

export type CalloutStyle = 'tip' | 'warning' | 'note' | 'chef_tip' | 'security';

export interface CalloutBlock {
  type: 'callout';
  variant?: 'chef_tip' | string;
  style: CalloutStyle;
  text: string;
}

export interface DefinitionBlock {
  type: 'definition';
  variant?: string;
  term: string;
  meaning: string;
}

// ===== NEW BLOCK TYPES =====

export interface KeyValueBlock {
  type: 'keyvalue';
  variant?: 'specs' | 'cost' | 'stats' | 'info' | 'location';
  items: { key: string; value: string }[];
}

export interface ComparisonBlock {
  type: 'comparison';
  variant?: 'dos_donts' | 'pros_cons' | 'versus' | 'before_after';
  left: { label: string; items: string[] };
  right: { label: string; items: string[] };
}

export interface TimestampBlock {
  type: 'timestamp';
  time: string;       // "5:23" format
  seconds: number;    // For video seeking
  label: string;
}

export interface QuoteBlock {
  type: 'quote';
  variant?: 'speaker' | 'testimonial' | 'highlight';
  text: string;
  attribution?: string;  // "Steve Jobs"
  timestamp?: number;    // seconds for video seek
}

export interface StatisticBlock {
  type: 'statistic';
  variant?: 'metric' | 'percentage' | 'trend';
  items: {
    value: string;       // "85%", "$1.2M", "3x"
    label: string;       // "Performance gain"
    context?: string;    // "vs previous version"
    trend?: 'up' | 'down' | 'neutral';
  }[];
}

export type ContentBlock =
  | ParagraphBlock
  | BulletsBlock
  | NumberedBlock
  | DoDoNotBlock
  | ExampleBlock
  | CalloutBlock
  | DefinitionBlock
  | KeyValueBlock
  | ComparisonBlock
  | TimestampBlock
  | QuoteBlock
  | StatisticBlock;

// ─────────────────────────────────────────────────────
// Section Type
// ─────────────────────────────────────────────────────

export interface Section {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  originalTitle?: string;      // Creator's original chapter title
  generatedTitle?: string;     // AI-generated explanation subtitle
  isCreatorChapter?: boolean;  // Flag for dual-title display
  content?: ContentBlock[];    // Dynamic content blocks
  summary: string;             // Legacy fallback
  bullets: string[];           // Legacy fallback
}

export interface Concept {
  id: string;
  name: string;
  definition: string | null;
  timestamp: string | null;
}

export interface VideoSummary {
  tldr: string;
  keyTakeaways: string[];
  sections: Section[];
  concepts: Concept[];
  masterSummary?: string;
}

// ─────────────────────────────────────────────────────
// Progressive Summarization Types (New)
// ─────────────────────────────────────────────────────

export type ChapterSource = 'creator' | 'description' | 'ai_detected';

export interface Chapter {
  startSeconds: number;
  endSeconds: number;
  title: string;
  isCreatorChapter: boolean;
}

export interface DescriptionLink {
  url: string;
  type: 'github' | 'documentation' | 'article' | 'tool' | 'course' | 'other';
  label: string;
}

export interface Resource {
  name: string;
  url: string;
}

export interface RelatedVideo {
  title: string;
  url: string;
}

export interface DescriptionTimestamp {
  time: string;
  label: string;
}

export interface SocialLink {
  platform: 'twitter' | 'discord' | 'github' | 'linkedin' | 'patreon' | 'other';
  url: string;
}

export interface DescriptionAnalysis {
  links: DescriptionLink[];
  resources: Resource[];
  relatedVideos: RelatedVideo[];
  timestamps: DescriptionTimestamp[];
  socialLinks: SocialLink[];
}

// ─────────────────────────────────────────────────────
// Sponsor Detection Types
// ─────────────────────────────────────────────────────

export type SponsorCategory = 'sponsor' | 'selfpromo' | 'intro' | 'outro' | 'interaction';

export interface SponsorSegment {
  startSeconds: number;
  endSeconds: number;
  category: SponsorCategory;
}

// ─────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface VideoResponse {
  id: string;
  videoSummaryId: string;
  youtubeId: string;
  title: string;
  channel: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  status: ProcessingStatus;
  folderId: string | null;
  createdAt: string;
  // Progressive summarization fields (optional for backward compat)
  chapters?: Chapter[];
  chapterSource?: ChapterSource;
  descriptionAnalysis?: DescriptionAnalysis;
  sponsorSegments?: SponsorSegment[];
  // Video context for persona-based rendering
  context?: VideoContext;
}

export interface FolderResponse {
  id: string;
  name: string;
  type: FolderType;
  parentId: string | null;
  path: string;
  level: number;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────
// WebSocket Event Types
// ─────────────────────────────────────────────────────

export interface VideoStatusEvent {
  type: 'video.status';
  payload: {
    videoSummaryId: string;
    userVideoId: string;
    youtubeId: string;
    status: ProcessingStatus;
    progress: number;
    message?: string;
    error?: string;
  };
}

export interface ExpansionStatusEvent {
  type: 'expansion.status';
  payload: {
    videoSummaryId: string;
    targetType: TargetType;
    targetId: string;
    status: ProcessingStatus;
    error?: string;
  };
}

export type WebSocketEvent = VideoStatusEvent | ExpansionStatusEvent;

// ─────────────────────────────────────────────────────
// SSE Stream Event Types (Progressive Summarization)
// ─────────────────────────────────────────────────────

export type SummaryStreamPhase =
  | 'metadata'
  | 'transcript'
  | 'parallel_analysis'
  | 'section_detect'
  | 'section_summaries'
  | 'concepts'
  | 'master_summary';

export interface SSEMetadataEvent {
  event: 'metadata';
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  duration: number;
  context?: VideoContext;
}

export interface SSEChaptersEvent {
  event: 'chapters';
  chapters: Chapter[];
  isCreatorChapters: boolean;
}

export interface SSEDescriptionAnalysisEvent {
  event: 'description_analysis';
  links: DescriptionLink[];
  resources: Resource[];
  relatedVideos: RelatedVideo[];
  timestamps: DescriptionTimestamp[];
  socialLinks: SocialLink[];
}

export interface SSESynthesisCompleteEvent {
  event: 'synthesis_complete';
  tldr: string;
  keyTakeaways: string[];
}

export interface SSESectionReadyEvent {
  event: 'section_ready';
  index: number;
  section: Section;
}

export interface SSEConceptsCompleteEvent {
  event: 'concepts_complete';
  concepts: Concept[];
}

export interface SSEMasterSummaryCompleteEvent {
  event: 'master_summary_complete';
  masterSummary: string;
}

export interface SSEDoneEvent {
  event: 'done';
  videoSummaryId: string;
  processingTimeMs?: number;
  cached?: boolean;
}

export interface SSEPhaseEvent {
  event: 'phase';
  phase: SummaryStreamPhase;
}

export interface SSETokenEvent {
  event: 'token';
  phase: string;
  token: string;
}

export interface SSEErrorEvent {
  event: 'error';
  message: string;
  code?: string;
}

export type SSEStreamEvent =
  | SSEMetadataEvent
  | SSEChaptersEvent
  | SSEDescriptionAnalysisEvent
  | SSESynthesisCompleteEvent
  | SSESectionReadyEvent
  | SSEConceptsCompleteEvent
  | SSEMasterSummaryCompleteEvent
  | SSEDoneEvent
  | SSEPhaseEvent
  | SSETokenEvent
  | SSEErrorEvent;

// ─────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export const ErrorCodes = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  REFRESH_EXPIRED: 'REFRESH_EXPIRED',

  // Video
  INVALID_YOUTUBE_URL: 'INVALID_YOUTUBE_URL',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  NO_TRANSCRIPT: 'NO_TRANSCRIPT',
  VIDEO_TOO_LONG: 'VIDEO_TOO_LONG',
  VIDEO_TOO_SHORT: 'VIDEO_TOO_SHORT',
  VIDEO_UNAVAILABLE: 'VIDEO_UNAVAILABLE',

  // General
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
