// ═══════════════════════════════════════════════════
// Memorized Item Types
// ═══════════════════════════════════════════════════

import type { SummaryChapter, VideoContext } from './video.js';

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
