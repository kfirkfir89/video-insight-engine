import { FastifyBaseLogger } from 'fastify';
import { ObjectId } from 'mongodb';
import {
  MemorizeRepository,
  MemorizedItemDocument,
  CreateMemorizedItemData,
  UpdateMemorizedItemData,
} from '../repositories/memorize.repository.js';
import { VideoRepository } from '../repositories/video.repository.js';
import { MemorizedItemNotFoundError } from '../utils/errors.js';

export interface MemorizedItemListResponse {
  id: string;
  title: string;
  sourceType: 'video_section' | 'video_concept' | 'system_expansion';
  source: {
    videoTitle: string;
    youtubeUrl: string;
  };
  folderId: string | null;
  tags: string[];
  createdAt: string;
}

export interface MemorizedItemDetailResponse {
  id: string;
  title: string;
  sourceType: 'video_section' | 'video_concept' | 'system_expansion';
  source: {
    videoSummaryId: string;
    youtubeId: string;
    videoTitle: string;
    videoThumbnail: string;
    youtubeUrl: string;
    startSeconds?: number;
    endSeconds?: number;
    content: MemorizedItemDocument['source']['content'];
  };
  folderId: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemorizedItemInput {
  userId: string;
  title: string;
  sourceType: 'video_section' | 'video_concept' | 'system_expansion';
  videoSummaryId: string;
  sectionIds?: string[];
  conceptId?: string;
  expansionId?: string;
  startSeconds?: number;
  endSeconds?: number;
  folderId?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface UpdateMemorizedItemInput {
  title?: string;
  notes?: string | null;
  tags?: string[];
  folderId?: string | null;
}

function toListResponse(item: MemorizedItemDocument): MemorizedItemListResponse {
  return {
    id: item._id.toHexString(),
    title: item.title,
    sourceType: item.sourceType,
    source: {
      videoTitle: item.source.videoTitle,
      youtubeUrl: item.source.youtubeUrl,
    },
    folderId: item.folderId?.toHexString() ?? null,
    tags: item.tags,
    createdAt: item.createdAt.toISOString(),
  };
}

function toDetailResponse(item: MemorizedItemDocument): MemorizedItemDetailResponse {
  return {
    id: item._id.toHexString(),
    title: item.title,
    sourceType: item.sourceType,
    source: {
      videoSummaryId: item.source.videoSummaryId.toHexString(),
      youtubeId: item.source.youtubeId,
      videoTitle: item.source.videoTitle,
      videoThumbnail: item.source.videoThumbnail,
      youtubeUrl: item.source.youtubeUrl,
      startSeconds: item.source.startSeconds,
      endSeconds: item.source.endSeconds,
      content: item.source.content,
    },
    folderId: item.folderId?.toHexString() ?? null,
    notes: item.notes,
    tags: item.tags,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export class MemorizeService {
  constructor(
    private readonly memorizeRepository: MemorizeRepository,
    private readonly videoRepository: VideoRepository,
    private readonly logger: FastifyBaseLogger
  ) {}

  async list(
    userId: string,
    folderId?: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<MemorizedItemListResponse[]> {
    const items = await this.memorizeRepository.list(userId, folderId, options);
    return items.map(toListResponse);
  }

  async getById(userId: string, itemId: string): Promise<MemorizedItemDetailResponse> {
    const item = await this.memorizeRepository.findById(userId, itemId);
    if (!item) {
      throw new MemorizedItemNotFoundError();
    }
    return toDetailResponse(item);
  }

  async create(input: CreateMemorizedItemInput): Promise<MemorizedItemDetailResponse> {
    // Fetch the video summary cache to get content
    const videoSummary = await this.memorizeRepository.getVideoSummaryCache(input.videoSummaryId);

    if (!videoSummary || !videoSummary.summary) {
      throw new Error('Video summary not found or not processed');
    }

    // Build the source content based on sourceType
    let content: MemorizedItemDocument['source']['content'] = {};
    let startSeconds: number | undefined;
    let endSeconds: number | undefined;

    if (input.sourceType === 'video_section' && input.sectionIds) {
      // Try V1 summary.chapters first
      const v1Sections = videoSummary.summary?.sections?.filter((s) =>
        input.sectionIds!.includes(s.id)
      ) ?? [];

      if (v1Sections.length > 0) {
        // V1: Store content blocks from chapters
        content.sections = v1Sections.map((s) => ({
          id: s.id,
          timestamp: s.timestamp,
          title: s.title,
          content: s.content,
        }));
        startSeconds = input.startSeconds ?? v1Sections[0].startSeconds;
        endSeconds = input.endSeconds ?? v1Sections[v1Sections.length - 1].endSeconds;
      } else if (videoSummary.output?.data) {
        // Intent-driven pipeline: sectionIds are keys in output.data
        const outputSections = input.sectionIds!.filter(
          (id) => id in (videoSummary.output!.data as Record<string, unknown>)
        );
        if (outputSections.length === 0) {
          throw new Error('No matching sections found');
        }
        content.sections = outputSections.map((sectionId) => {
          const intentSection = videoSummary.intent?.sections?.find((s) => s.id === sectionId);
          return {
            id: sectionId,
            timestamp: '00:00',
            title: intentSection?.label ?? sectionId.replace(/_/g, ' '),
            content: [{ type: 'typed_output', data: (videoSummary.output!.data as Record<string, unknown>)[sectionId] }] as unknown as import('@vie/types').ContentBlock[],
          };
        });
        startSeconds = input.startSeconds;
        endSeconds = input.endSeconds;
      } else {
        throw new Error('No matching sections found');
      }
    } else if (input.sourceType === 'video_concept' && input.conceptId) {
      const concept = videoSummary.summary?.concepts?.find(
        (c) => c.id === input.conceptId
      );

      if (!concept) {
        throw new Error('Concept not found');
      }

      content.concept = {
        name: concept.name,
        definition: concept.definition,
      };
    } else if (input.sourceType === 'system_expansion' && input.expansionId) {
      const expansion = await this.memorizeRepository.getSystemExpansion(input.expansionId);

      if (!expansion) {
        throw new Error('Expansion not found');
      }

      content.expansion = expansion.content;
    }

    const youtubeUrl = startSeconds
      ? `${videoSummary.url}&t=${startSeconds}`
      : videoSummary.url;

    const data: CreateMemorizedItemData = {
      userId: input.userId,
      title: input.title,
      sourceType: input.sourceType,
      source: {
        videoSummaryId: new ObjectId(input.videoSummaryId),
        youtubeId: videoSummary.youtubeId,
        videoTitle: videoSummary.title,
        videoThumbnail: videoSummary.thumbnailUrl ?? '',
        youtubeUrl,
        startSeconds,
        endSeconds,
        sectionIds: input.sectionIds,
        expansionId: input.expansionId ? new ObjectId(input.expansionId) : undefined,
        content,
      },
      folderId: input.folderId,
      notes: input.notes,
      tags: input.tags,
    };

    const item = await this.memorizeRepository.create(data);
    return toDetailResponse(item);
  }

  async update(
    userId: string,
    itemId: string,
    input: UpdateMemorizedItemInput
  ): Promise<MemorizedItemDetailResponse> {
    const updates: UpdateMemorizedItemData = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.folderId !== undefined) updates.folderId = input.folderId;

    const updated = await this.memorizeRepository.update(userId, itemId, updates);
    if (!updated) {
      throw new MemorizedItemNotFoundError();
    }

    return toDetailResponse(updated);
  }

  async delete(userId: string, itemId: string): Promise<void> {
    const deleted = await this.memorizeRepository.delete(userId, itemId);
    if (!deleted) {
      throw new MemorizedItemNotFoundError();
    }
  }

  async listChats(userId: string, itemId: string) {
    const chats = await this.memorizeRepository.listChats(userId, itemId);
    return chats.map((chat) => ({
      id: chat._id.toHexString(),
      title: chat.title,
      messageCount: chat.messages.length,
      updatedAt: chat.updatedAt.toISOString(),
    }));
  }
}
