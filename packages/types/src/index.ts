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
// Base Block Interface (V2.1)
// All content blocks extend this for stable identification
// ─────────────────────────────────────────────────────

export interface BaseBlock {
  /** Stable UUID for tracking, analytics, and React keys */
  blockId: string;
}

// ─────────────────────────────────────────────────────
// Transcript Types (Phase 2 & 3)
// ─────────────────────────────────────────────────────

export type TranscriptSource = 'ytdlp' | 'api' | 'proxy' | 'whisper';

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * Full transcript stored in S3 for regeneration without re-fetching from YouTube.
 * S3 key format: `transcripts/{youtubeId}.json`
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

// ─────────────────────────────────────────────────────
// Video Context Types
// ─────────────────────────────────────────────────────

/** @deprecated Use VideoCategory instead */
export type VideoPersona = 'code' | 'recipe' | 'standard' | 'interview' | 'review';

/** Video category values for UI theming (V2.1) */
export const VIDEO_CATEGORY_VALUES = [
  'cooking',
  'coding',
  'travel',
  'reviews',
  'fitness',
  'education',
  'podcast',
  'diy',
  'gaming',
  'standard',
] as const;

/** Video category for UI theming (V2.1) */
export type VideoCategory = (typeof VIDEO_CATEGORY_VALUES)[number];

export interface VideoContext {
  category: VideoCategory;    // User-facing category for UI theming
  youtubeCategory: string;    // Raw YouTube category
  tags: string[];
  displayTags: string[];
}

// ─────────────────────────────────────────────────────
// Video Summary Types
// ─────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────
// Content Block Types (Dynamic Chapter Content)
// ─────────────────────────────────────────────────────
// Base interface for all content blocks - provides stable block identifiers
export interface BaseBlock {
  blockId: string;  // UUID - stable identifier for referencing
  type: string;
  variant?: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
}

export interface BulletsBlock extends BaseBlock {
  type: 'bullets';
  variant?: 'ingredients' | 'checklist' | string;
  items: string[];
}

export interface NumberedBlock extends BaseBlock {
  type: 'numbered';
  variant?: 'cooking_steps' | string;
  items: string[];
}

export interface DoDoNotBlock extends BaseBlock {
  type: 'do_dont';
  do: string[];
  dont: string[];
}

export interface ExampleBlock extends BaseBlock {
  type: 'example';
  variant?: 'terminal_command' | string;
  title?: string;
  code: string;
  explanation?: string;
}

export type CalloutStyle = 'tip' | 'warning' | 'note' | 'chef_tip' | 'security';

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  variant?: 'chef_tip' | string;
  style: CalloutStyle;
  text: string;
}

export interface DefinitionBlock extends BaseBlock {
  type: 'definition';
  term: string;
  meaning: string;
}

export interface KeyValueBlock extends BaseBlock {
  type: 'keyvalue';
  variant?: 'specs' | 'cost' | 'stats' | 'info' | 'location';
  items: { key: string; value: string }[];
}

export interface ComparisonBlock extends BaseBlock {
  type: 'comparison';
  variant?: 'dos_donts' | 'pros_cons' | 'versus' | 'before_after';
  left: { label: string; items: string[] };
  right: { label: string; items: string[] };
}

export interface TimestampBlock extends BaseBlock {
  type: 'timestamp';
  time: string;       // "5:23" format
  seconds: number;    // For video seeking
  label: string;
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  variant?: 'speaker' | 'testimonial' | 'highlight';
  text: string;
  attribution?: string;  // "Steve Jobs"
  timestamp?: number;    // seconds for video seek
}

export interface StatisticBlock extends BaseBlock {
  type: 'statistic';
  variant?: 'metric' | 'percentage' | 'trend';
  items: {
    value: string;       // "85%", "$1.2M", "3x"
    label: string;       // "Performance gain"
    context?: string;    // "vs previous version"
    trend?: 'up' | 'down' | 'neutral';
  }[];
}

// ===== NEW UNIVERSAL BLOCKS (V2.1) =====

export interface TranscriptBlock extends Partial<BaseBlock> {
  type: 'transcript';
  lines: {
    time: string;
    seconds: number;
    text: string;
  }[];
}

export interface TimelineBlock extends Partial<BaseBlock> {
  type: 'timeline';
  events: {
    date?: string;
    time?: string;
    title: string;
    description?: string;
  }[];
}

export interface ToolListBlock extends Partial<BaseBlock> {
  type: 'tool_list';
  tools: {
    name: string;
    quantity?: string;
    notes?: string;
    checked?: boolean;
  }[];
}

// ===== CATEGORY-SPECIFIC BLOCKS (V2.1) =====

// Cooking blocks
export interface IngredientBlock extends Partial<BaseBlock> {
  type: 'ingredient';
  servings?: number;
  items: {
    name: string;
    amount?: string;
    unit?: string;
    notes?: string;
    checked?: boolean;
  }[];
}

export interface StepBlock extends Partial<BaseBlock> {
  type: 'step';
  steps: {
    number: number;
    instruction: string;
    duration?: number; // seconds
    tips?: string;
  }[];
}

export interface NutritionBlock extends Partial<BaseBlock> {
  type: 'nutrition';
  servingSize?: string;
  items: {
    nutrient: string;
    amount: string;
    unit?: string;
    dailyValue?: string;
  }[];
}

// Coding blocks
export interface CodeBlock extends Partial<BaseBlock> {
  type: 'code';
  language?: string;
  code: string;
  filename?: string;
  highlightLines?: number[];
}

export interface TerminalBlock extends Partial<BaseBlock> {
  type: 'terminal';
  command: string;
  output?: string;
}

export interface FileTreeBlock extends Partial<BaseBlock> {
  type: 'file_tree';
  tree: FileTreeNode[];
}

export interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  expanded?: boolean;
}

// Travel blocks
export interface LocationBlock extends Partial<BaseBlock> {
  type: 'location';
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  description?: string;
  imageUrl?: string;
  mapUrl?: string;
}

export interface ItineraryBlock extends Partial<BaseBlock> {
  type: 'itinerary';
  days: {
    day: number;
    title?: string;
    activities: {
      time?: string;
      activity: string;
      location?: string;
      duration?: string;
      notes?: string;
    }[];
  }[];
}

export interface CostBlock extends Partial<BaseBlock> {
  type: 'cost';
  currency?: string;
  items: {
    category: string;
    amount: number;
    notes?: string;
  }[];
  total?: number;
}

// Review blocks
export interface ProConBlock extends Partial<BaseBlock> {
  type: 'pro_con';
  pros: string[];
  cons: string[];
}

export interface RatingBlock extends Partial<BaseBlock> {
  type: 'rating';
  score: number;
  maxScore: number;
  label?: string;
  breakdown?: {
    category: string;
    score: number;
    maxScore?: number;
  }[];
}

export interface VerdictBlock extends Partial<BaseBlock> {
  type: 'verdict';
  verdict: 'recommended' | 'not_recommended' | 'conditional' | 'neutral';
  summary: string;
  bestFor?: string[];
  notFor?: string[];
}

// Fitness blocks
export interface ExerciseBlock extends Partial<BaseBlock> {
  type: 'exercise';
  exercises: {
    name: string;
    sets?: number;
    reps?: string;
    duration?: string;
    rest?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    notes?: string;
    timestamp?: number;
  }[];
}

export interface WorkoutTimerBlock extends Partial<BaseBlock> {
  type: 'workout_timer';
  intervals: {
    name: string;
    duration: number; // seconds
    type: 'work' | 'rest' | 'warmup' | 'cooldown';
  }[];
  rounds?: number;
}

// Education blocks
export interface QuizBlock extends Partial<BaseBlock> {
  type: 'quiz';
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }[];
}

export interface FormulaBlock extends Partial<BaseBlock> {
  type: 'formula';
  latex: string;
  description?: string;
  inline?: boolean;
}

// Podcast blocks
export interface GuestBlock extends Partial<BaseBlock> {
  type: 'guest';
  guests: {
    name: string;
    title?: string;
    bio?: string;
    imageUrl?: string;
    socialLinks?: { platform: string; url: string }[];
  }[];
}

// ===== CONTENT BLOCK UNION (V2.1) =====

export type ContentBlock =
  // Existing blocks
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
  | StatisticBlock
  // New universal blocks (V2.1)
  | TranscriptBlock
  | TimelineBlock
  | ToolListBlock
  // Cooking blocks (V2.1)
  | IngredientBlock
  | StepBlock
  | NutritionBlock
  // Coding blocks (V2.1)
  | CodeBlock
  | TerminalBlock
  | FileTreeBlock
  // Travel blocks (V2.1)
  | LocationBlock
  | ItineraryBlock
  | CostBlock
  // Review blocks (V2.1)
  | ProConBlock
  | RatingBlock
  | VerdictBlock
  // Fitness blocks (V2.1)
  | ExerciseBlock
  | WorkoutTimerBlock
  // Education blocks (V2.1)
  | QuizBlock
  | FormulaBlock
  // Podcast blocks (V2.1)
  | GuestBlock;

/** All possible block type strings */
export type ContentBlockType = ContentBlock['type'];

// ─────────────────────────────────────────────────────
// Chapter Type (formerly Section)
// ─────────────────────────────────────────────────────
export interface SummaryChapter {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  originalTitle?: string;      // Creator's original chapter title
  generatedTitle?: string;     // AI-generated explanation subtitle
  isCreatorChapter: boolean;   // Flag for dual-title display
  content?: ContentBlock[];    // Dynamic content blocks with blockId - source of truth
  /** Raw transcript slice for this chapter's time range (for RAG/display) */
  transcript?: string;
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
  chapters: SummaryChapter[];
  concepts: Concept[];
  masterSummary?: string;
  /** Reference to full transcript in S3 (e.g., "transcripts/{youtubeId}.json") */
  rawTranscriptRef?: string | null;
  /** Generation metadata for tracking prompt versions and regeneration */
  generation?: GenerationMetadata;
}

// ─────────────────────────────────────────────────────
// Memorized Item Types (V2.1)
// ─────────────────────────────────────────────────────
export type MemorizedItemSourceType = 'video_chapters' | 'concept' | 'expansion';

export interface MemorizedItemSource {
  videoSummaryId: string;
  youtubeId: string;
  videoTitle: string;
  thumbnailUrl: string;
  youtubeUrl: string;
}

export interface MemorizedItem {
  id: string;
  userId: string;
  title: string;
  folderId: string | null;
  sourceType: MemorizedItemSourceType;
  source: MemorizedItemSource;
  chapters: SummaryChapter[];
  concept?: {
    id: string;
    name: string;
    definition: string | null;
  };
  expansion?: {
    expansionId: string;
    content: string;
  };
  videoContext: VideoContext | null;
  notes: string | null;
  tags: string[];
  collectionIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────
// Progressive Summarization Types (New)
// ─────────────────────────────────────────────────────

export type ChapterSource = 'creator' | 'description' | 'ai_detected';

/** Simplified chapter info used during progressive streaming */
export interface StreamingChapter {
  startSeconds: number;
  endSeconds: number;
  title: string;
  isCreatorChapter: boolean;
}

/** Chapter alias - same as StreamingChapter for progressive streaming */
export type Chapter = StreamingChapter;

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

export interface SocialLink {
  platform: 'twitter' | 'discord' | 'github' | 'linkedin' | 'patreon' | 'other';
  url: string;
}

export interface DescriptionAnalysis {
  links: DescriptionLink[];
  resources: Resource[];
  relatedVideos: RelatedVideo[];
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
// Playlist Types
// ─────────────────────────────────────────────────────

export type PlaylistMode = 'video' | 'playlist';

/**
 * Playlist context stored in userVideos for ordering within a playlist.
 * Stored in userVideos (not cache) because same video can be in multiple playlists.
 */
export interface PlaylistInfo {
  playlistId: string;
  playlistTitle: string;
  position: number;       // 0-indexed order in playlist
  totalVideos: number;    // Total videos at import time
}

/**
 * Video info within a playlist preview (before import).
 */
export interface PlaylistVideo {
  videoId: string;
  title: string;
  position: number;
  duration: number | null;
  thumbnailUrl: string | null;
  isCached: boolean;
}

/**
 * Playlist preview response - returned before importing.
 */
export interface PlaylistPreview {
  playlistId: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  totalVideos: number;
  videos: PlaylistVideo[];
  cachedCount: number;
}

/**
 * Video entry in playlist import result.
 */
export interface PlaylistImportVideo {
  id: string;
  videoSummaryId: string;
  youtubeId: string;
  title: string | null;
  status: string;
  position: number;
}

/**
 * Result of importing a playlist.
 */
export interface PlaylistImportResult {
  folder: { id: string; name: string };
  videos: PlaylistImportVideo[];
  totalVideos: number;
  cachedCount: number;
  processingCount: number;
  failedCount: number;
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
  chapters?: StreamingChapter[];
  chapterSource?: ChapterSource;
  descriptionAnalysis?: DescriptionAnalysis;
  sponsorSegments?: SponsorSegment[];
  // Video context for persona-based rendering
  context?: VideoContext;
  // Playlist context (if video was added via playlist import)
  playlistInfo?: PlaylistInfo;
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

export interface VideoMetadataEvent {
  type: 'video.metadata';
  payload: {
    videoSummaryId: string;
    title: string;
    channel?: string;
    thumbnailUrl?: string;
    duration?: number;
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

export type WebSocketEvent = VideoStatusEvent | VideoMetadataEvent | ExpansionStatusEvent;

// ─────────────────────────────────────────────────────
// SSE Stream Event Types (Progressive Summarization)
// ─────────────────────────────────────────────────────

export type SummaryStreamPhase =
  | 'metadata'
  | 'transcript'
  | 'parallel_analysis'
  | 'chapter_detect'
  | 'chapter_summaries'
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
  chapters: StreamingChapter[];
  isCreatorChapters: boolean;
}

export interface SSEDescriptionAnalysisEvent {
  event: 'description_analysis';
  links: DescriptionLink[];
  resources: Resource[];
  relatedVideos: RelatedVideo[];
  socialLinks: SocialLink[];
}

export interface SSESynthesisCompleteEvent {
  event: 'synthesis_complete';
  tldr: string;
  keyTakeaways: string[];
}

export interface SSEChapterReadyEvent {
  event: 'chapter_ready';
  index: number;
  chapter: SummaryChapter;
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
  | SSEChapterReadyEvent
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

  // Playlist
  INVALID_PLAYLIST_URL: 'INVALID_PLAYLIST_URL',
  PLAYLIST_NOT_FOUND: 'PLAYLIST_NOT_FOUND',
  PLAYLIST_EXTRACTION_FAILED: 'PLAYLIST_EXTRACTION_FAILED',
  PLAYLIST_TOO_LARGE: 'PLAYLIST_TOO_LARGE',
  URL_MODE_MISMATCH: 'URL_MODE_MISMATCH',

  // General
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
