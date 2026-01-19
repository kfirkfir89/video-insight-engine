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

export type FolderType = 'summarized' | 'memorized';

export type SourceType =
  | 'video_section'
  | 'video_concept'
  | 'system_expansion';

export type TargetType = 'section' | 'concept';

// ─────────────────────────────────────────────────────
// Video Summary Types
// ─────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────
// Content Block Types (Dynamic Section Content)
// ─────────────────────────────────────────────────────

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface BulletsBlock {
  type: 'bullets';
  items: string[];
}

export interface NumberedBlock {
  type: 'numbered';
  items: string[];
}

export interface DoDoNotBlock {
  type: 'do_dont';
  do: string[];
  dont: string[];
}

export interface ExampleBlock {
  type: 'example';
  title?: string;
  code: string;
  explanation?: string;
}

export type CalloutStyle = 'tip' | 'warning' | 'note';

export interface CalloutBlock {
  type: 'callout';
  style: CalloutStyle;
  text: string;
}

export interface DefinitionBlock {
  type: 'definition';
  term: string;
  meaning: string;
}

export type ContentBlock =
  | ParagraphBlock
  | BulletsBlock
  | NumberedBlock
  | DoDoNotBlock
  | ExampleBlock
  | CalloutBlock
  | DefinitionBlock;

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
  | 'concepts';

export interface SSEMetadataEvent {
  event: 'metadata';
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  duration: number;
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
