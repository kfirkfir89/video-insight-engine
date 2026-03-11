// ═══════════════════════════════════════════════════
// Video Types — Context, Summary, Response
// ═══════════════════════════════════════════════════

import type { ContentBlock } from './content-blocks.js';
import type { GenerationMetadata, ProcessingStatus } from './common.js';
import type { OutputType } from './output-types.js';
import type { PlaylistInfo } from './playlist.js';
import type { ShareInfo } from './share.js';

// ─────────────────────────────────────────────────────
// Video Context
// ─────────────────────────────────────────────────────

/** Video category values for UI theming */
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

/** Video category for UI theming */
export type VideoCategory = (typeof VIDEO_CATEGORY_VALUES)[number];

export interface VideoContext {
  category: VideoCategory;    // User-facing category for UI theming
  youtubeCategory: string;    // Raw YouTube category
  tags: string[];
  displayTags: string[];
  categoryConfidence?: number; // Detection confidence (0.0-1.0), used internally
}

// ─────────────────────────────────────────────────────
// Chapter & Summary Types (used by MemorizedItem, share, etc.)
// ─────────────────────────────────────────────────────

export interface SummaryChapter {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  originalTitle?: string;
  generatedTitle?: string;
  isCreatorChapter: boolean;
  content?: ContentBlock[];
  view?: VideoCategory;
  transcript?: string;
}

export interface Concept {
  id: string;
  name: string;
  definition: string | null;
  timestamp: string | null;
  aliases?: string[];
  chapterIndex?: number;
}

export interface VideoSummary {
  tldr: string;
  keyTakeaways: string[];
  chapters: SummaryChapter[];
  concepts: Concept[];
  masterSummary?: string;
  rawTranscriptRef?: string | null;
  generation?: GenerationMetadata;
  outputType?: OutputType;
}

// ─────────────────────────────────────────────────────
// Description Analysis
// ─────────────────────────────────────────────────────

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
// Sponsor Detection
// ─────────────────────────────────────────────────────

export type SponsorCategory = 'sponsor' | 'selfpromo' | 'intro' | 'outro' | 'interaction';

export interface SponsorSegment {
  startSeconds: number;
  endSeconds: number;
  category: SponsorCategory;
}

// ─────────────────────────────────────────────────────
// Streaming Types (progressive summarization)
// ─────────────────────────────────────────────────────

export type ChapterSource = 'creator' | 'description' | 'ai_detected';

export interface StreamingChapter {
  startSeconds: number;
  endSeconds: number;
  title: string;
  isCreatorChapter: boolean;
}

export type Chapter = StreamingChapter;

// ─────────────────────────────────────────────────────
// Video Response
// ─────────────────────────────────────────────────────

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
  chapters?: StreamingChapter[];
  chapterSource?: ChapterSource;
  descriptionAnalysis?: DescriptionAnalysis;
  sponsorSegments?: SponsorSegment[];
  context?: VideoContext;
  playlistInfo?: PlaylistInfo;
  outputType?: OutputType;
  shareInfo?: ShareInfo;
  expiresAt?: string;
}
