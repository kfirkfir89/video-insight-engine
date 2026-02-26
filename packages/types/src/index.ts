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

// ─────────────────────────────────────────────────────
// Video Context Types
// ─────────────────────────────────────────────────────

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
  'music',
  'standard',
] as const;

/** Video category for UI theming (V2.1) */
export type VideoCategory = (typeof VIDEO_CATEGORY_VALUES)[number];

export interface VideoContext {
  category: VideoCategory;    // User-facing category for UI theming
  youtubeCategory: string;    // Raw YouTube category
  tags: string[];
  displayTags: string[];
  categoryConfidence?: number; // Detection confidence (0.0-1.0), used internally
}

// ─────────────────────────────────────────────────────
// Video Summary Types
// ─────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────
// Content Block Types (Dynamic Chapter Content)
// ─────────────────────────────────────────────────────
// Base interface for all content blocks - provides stable block identifiers.
// blockId is injected by inject_block_ids() in the summarizer before reaching
// the frontend — always present at runtime. Required in the type to enforce
// null-safe usage in React keys and analytics.
export interface BaseBlock {
  /** Stable UUID for tracking, analytics, and React keys. Injected server-side. */
  blockId: string;
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

export interface TranscriptBlock extends BaseBlock {
  type: 'transcript';
  lines: {
    time: string;
    seconds: number;
    text: string;
  }[];
}

export interface TimelineBlock extends BaseBlock {
  type: 'timeline';
  events: {
    date?: string;
    time?: string;
    title: string;
    description?: string;
  }[];
}

export interface ToolListBlock extends BaseBlock {
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
export interface IngredientBlock extends BaseBlock {
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

export interface StepBlock extends BaseBlock {
  type: 'step';
  steps: {
    number: number;
    instruction: string;
    duration?: number; // seconds
    tips?: string;
  }[];
}

export interface NutritionBlock extends BaseBlock {
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
export interface CodeBlock extends BaseBlock {
  type: 'code';
  language?: string;
  code: string;
  filename?: string;
  highlightLines?: number[];
}

export interface TerminalBlock extends BaseBlock {
  type: 'terminal';
  command: string;
  output?: string;
}

export interface FileTreeBlock extends BaseBlock {
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
export interface LocationBlock extends BaseBlock {
  type: 'location';
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  description?: string;
  imageUrl?: string;
  mapUrl?: string;
}

export interface ItineraryBlock extends BaseBlock {
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

export interface CostBlock extends BaseBlock {
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
export interface ProConBlock extends BaseBlock {
  type: 'pro_con';
  pros: string[];
  cons: string[];
}

export interface RatingBlock extends BaseBlock {
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

export interface VerdictBlock extends BaseBlock {
  type: 'verdict';
  verdict: 'recommended' | 'not_recommended' | 'conditional' | 'neutral';
  summary: string;
  bestFor?: string[];
  notFor?: string[];
}

// Fitness blocks
export interface ExerciseBlock extends BaseBlock {
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

export interface WorkoutTimerBlock extends BaseBlock {
  type: 'workout_timer';
  intervals: {
    name: string;
    duration: number; // seconds
    type: 'work' | 'rest' | 'warmup' | 'cooldown';
  }[];
  rounds?: number;
}

// Education blocks
export interface QuizBlock extends BaseBlock {
  type: 'quiz';
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }[];
}

export interface FormulaBlock extends BaseBlock {
  type: 'formula';
  latex: string;
  description?: string;
  inline?: boolean;
}

// Podcast blocks
export interface GuestBlock extends BaseBlock {
  type: 'guest';
  guests: {
    name: string;
    title?: string;
    bio?: string;
    imageUrl?: string;
    socialLinks?: { platform: string; url: string }[];
  }[];
}

// Generic table block
export interface TableBlock extends BaseBlock {
  type: 'table';
  caption?: string;
  columns: {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
  }[];
  rows: Record<string, string | number>[];
  highlightRows?: number[];
}

// Problem/Solution blocks
export interface ProblemSolutionBlock extends BaseBlock {
  type: 'problem_solution';
  problem: string;
  solution: string;
  context?: string;
}

// Visual moment blocks
// TODO: If more snake_case fields are needed from the Python backend,
// introduce a generic wire->client key transform utility instead of ad-hoc exceptions.

/**
 * Individual frame within a multi-frame visual block (slideshow/gallery).
 *
 * NOTE: `s3_key` uses snake_case to match the Python backend wire format
 * (JSON over SSE). This is a deliberate exception to the camelCase convention
 * to avoid a transform layer at the API boundary. If more snake_case fields
 * are needed in the future, consider a generic key-transform utility instead.
 */
export interface VisualFrame {
  timestamp: number;
  /** S3 object key — snake_case matches Python backend wire format. */
  s3_key?: string;
  imageUrl?: string;
  caption?: string;
}

/**
 * Visual moment block — diagrams, screenshots, demos, slideshows.
 *
 * See VisualFrame for the snake_case convention rationale on `s3_key`.
 */
export interface VisualBlock extends BaseBlock {
  type: 'visual';
  description?: string;
  timestamp?: number;          // primary frame (backward compat)
  label?: string;
  /** S3 object key — snake_case matches Python backend wire format. */
  s3_key?: string;
  /** Ephemeral presigned URL — refreshed at response time from s3_key. */
  imageUrl?: string;
  variant?: 'diagram' | 'screenshot' | 'demo' | 'whiteboard' | 'slideshow' | 'gallery';
  /** Multi-frame: slideshows, galleries, step-by-step sequences. */
  frames?: VisualFrame[];
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
  | GuestBlock
  // Quality blocks
  | ProblemSolutionBlock
  | VisualBlock
  // Generic blocks
  | TableBlock;

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
  /** Per-chapter view for specialized rendering. Falls back to global category if absent. */
  view?: VideoCategory;
  /** Raw transcript slice for this chapter's time range (for RAG/display) */
  transcript?: string;
}


export interface Concept {
  id: string;
  name: string;
  definition: string | null;
  timestamp: string | null;
  /** Optional LLM-provided aliases/short forms for improved content matching */
  aliases?: string[];
  /** 0-based chapter index where this concept was extracted (per-chapter extraction) */
  chapterIndex?: number;
}

export interface VideoSummary {
  tldr: string;
  keyTakeaways: string[];
  chapters: SummaryChapter[];
  concepts: Concept[];
  masterSummary?: string;
  /** Reference to full transcript in S3 (e.g., "videos/{youtubeId}/transcript.json") */
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
  | 'transcript_cached'
  | 'audio_transcription'
  | 'whisper_transcription'
  | 'metadata_fallback'
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
