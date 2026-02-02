import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { ObjectId } from 'mongodb';
import { MemorizeService } from '../memorize.service.js';
import type {
  MemorizeRepository,
  MemorizedItemDocument,
  VideoSummaryCacheForMemorize,
  SystemExpansionDocument,
  UserChatDocument,
} from '../../repositories/memorize.repository.js';
import type { VideoRepository } from '../../repositories/video.repository.js';
import { MemorizedItemNotFoundError } from '../../utils/errors.js';

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => mockLogger),
  level: 'silent',
  silent: vi.fn(),
} as unknown as FastifyBaseLogger;

// Factory functions
function createMemorizedItemDocument(
  overrides: Partial<MemorizedItemDocument> = {}
): MemorizedItemDocument {
  const id = overrides._id ?? new ObjectId();
  return {
    _id: id,
    userId: new ObjectId(),
    title: 'Test Memorized Item',
    folderId: null,
    sourceType: 'video_section',
    source: {
      videoSummaryId: new ObjectId(),
      youtubeId: 'dQw4w9WgXcQ',
      videoTitle: 'Test Video',
      videoThumbnail: 'https://example.com/thumb.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      content: {
        sections: [
          {
            id: 'section-1',
            timestamp: '0:00',
            title: 'Introduction',
            summary: 'This is the introduction',
            bullets: ['Point 1', 'Point 2'],
          },
        ],
      },
    },
    notes: null,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createVideoSummaryCache(
  overrides: Partial<VideoSummaryCacheForMemorize> = {}
): VideoSummaryCacheForMemorize {
  return {
    _id: new ObjectId(),
    youtubeId: 'dQw4w9WgXcQ',
    title: 'Test Video',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    summary: {
      sections: [
        {
          id: 'section-1',
          timestamp: '0:00',
          startSeconds: 0,
          endSeconds: 60,
          title: 'Introduction',
          summary: 'This is the introduction',
          bullets: ['Point 1', 'Point 2'],
        },
        {
          id: 'section-2',
          timestamp: '1:00',
          startSeconds: 60,
          endSeconds: 120,
          title: 'Main Content',
          summary: 'This is the main content',
          bullets: ['Point A', 'Point B'],
        },
      ],
      concepts: [
        {
          id: 'concept-1',
          name: 'Test Concept',
          definition: 'A test concept definition',
        },
      ],
    },
    ...overrides,
  };
}

function createUserChatDocument(overrides: Partial<UserChatDocument> = {}): UserChatDocument {
  return {
    _id: new ObjectId(),
    userId: new ObjectId(),
    memorizedItemId: new ObjectId(),
    title: 'Test Chat',
    messages: [
      { role: 'user', content: 'Hello', createdAt: new Date() },
      { role: 'assistant', content: 'Hi there!', createdAt: new Date() },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('MemorizeService', () => {
  let memorizeService: MemorizeService;
  let mockMemorizeRepository: {
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    listChats: ReturnType<typeof vi.fn>;
    getVideoSummaryCache: ReturnType<typeof vi.fn>;
    getSystemExpansion: ReturnType<typeof vi.fn>;
  };
  let mockVideoRepository: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockMemorizeRepository = {
      findById: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      listChats: vi.fn(),
      getVideoSummaryCache: vi.fn(),
      getSystemExpansion: vi.fn(),
    };

    mockVideoRepository = {};

    memorizeService = new MemorizeService(
      mockMemorizeRepository as unknown as MemorizeRepository,
      mockVideoRepository as unknown as VideoRepository,
      mockLogger
    );
  });

  describe('list', () => {
    it('should return all memorized items for a user', async () => {
      const userId = new ObjectId().toHexString();
      const items = [
        createMemorizedItemDocument({ title: 'Item 1' }),
        createMemorizedItemDocument({ title: 'Item 2' }),
      ];
      mockMemorizeRepository.list.mockResolvedValue(items);

      const result = await memorizeService.list(userId);

      expect(mockMemorizeRepository.list).toHaveBeenCalledWith(userId, undefined, {});
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Item 1');
      expect(result[1].title).toBe('Item 2');
    });

    it('should filter items by folderId', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId().toHexString();
      const items = [createMemorizedItemDocument({ folderId: new ObjectId(folderId) })];
      mockMemorizeRepository.list.mockResolvedValue(items);

      const result = await memorizeService.list(userId, folderId);

      expect(mockMemorizeRepository.list).toHaveBeenCalledWith(userId, folderId, {});
      expect(result).toHaveLength(1);
    });

    it('should support pagination with limit and offset', async () => {
      const userId = new ObjectId().toHexString();
      const items = [createMemorizedItemDocument()];
      mockMemorizeRepository.list.mockResolvedValue(items);

      await memorizeService.list(userId, undefined, { limit: 10, offset: 20 });

      expect(mockMemorizeRepository.list).toHaveBeenCalledWith(userId, undefined, {
        limit: 10,
        offset: 20,
      });
    });

    it('should return empty array when no items exist', async () => {
      const userId = new ObjectId().toHexString();
      mockMemorizeRepository.list.mockResolvedValue([]);

      const result = await memorizeService.list(userId);

      expect(result).toEqual([]);
    });

    it('should return correct list response shape', async () => {
      const userId = new ObjectId().toHexString();
      const item = createMemorizedItemDocument({
        title: 'Test Item',
        sourceType: 'video_section',
        tags: ['tag1', 'tag2'],
      });
      mockMemorizeRepository.list.mockResolvedValue([item]);

      const result = await memorizeService.list(userId);

      expect(result[0]).toEqual({
        id: item._id.toHexString(),
        title: 'Test Item',
        sourceType: 'video_section',
        source: {
          videoTitle: item.source.videoTitle,
          youtubeUrl: item.source.youtubeUrl,
        },
        folderId: null,
        tags: ['tag1', 'tag2'],
        createdAt: expect.any(String),
      });
    });
  });

  describe('getById', () => {
    it('should return memorized item when found', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId();
      const item = createMemorizedItemDocument({ _id: itemId });
      mockMemorizeRepository.findById.mockResolvedValue(item);

      const result = await memorizeService.getById(userId, itemId.toHexString());

      expect(mockMemorizeRepository.findById).toHaveBeenCalledWith(userId, itemId.toHexString());
      expect(result.id).toBe(itemId.toHexString());
    });

    it('should throw MemorizedItemNotFoundError when item does not exist', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId().toHexString();
      mockMemorizeRepository.findById.mockResolvedValue(null);

      await expect(memorizeService.getById(userId, itemId)).rejects.toThrow(
        MemorizedItemNotFoundError
      );
    });

    it('should return detail response with all fields', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId();
      const videoSummaryId = new ObjectId();
      const item = createMemorizedItemDocument({
        _id: itemId,
        notes: 'Some notes',
        tags: ['important'],
        source: {
          videoSummaryId,
          youtubeId: 'abc123',
          videoTitle: 'My Video',
          videoThumbnail: 'thumb.jpg',
          youtubeUrl: 'https://youtube.com/watch?v=abc123',
          startSeconds: 30,
          endSeconds: 90,
          content: {
            sections: [{ id: 's1', timestamp: '0:30', title: 'Intro', summary: 'Summary', bullets: [] }],
          },
        },
      });
      mockMemorizeRepository.findById.mockResolvedValue(item);

      const result = await memorizeService.getById(userId, itemId.toHexString());

      expect(result).toMatchObject({
        id: itemId.toHexString(),
        notes: 'Some notes',
        tags: ['important'],
        source: expect.objectContaining({
          videoSummaryId: videoSummaryId.toHexString(),
          youtubeId: 'abc123',
          startSeconds: 30,
          endSeconds: 90,
        }),
      });
    });
  });

  describe('create', () => {
    it('should create memorized item from video section', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId();
      const videoSummary = createVideoSummaryCache({ _id: videoSummaryId });
      const createdItem = createMemorizedItemDocument();

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(videoSummary);
      mockMemorizeRepository.create.mockResolvedValue(createdItem);

      const result = await memorizeService.create({
        userId,
        title: 'My Section',
        sourceType: 'video_section',
        videoSummaryId: videoSummaryId.toHexString(),
        sectionIds: ['section-1'],
      });

      expect(mockMemorizeRepository.getVideoSummaryCache).toHaveBeenCalledWith(
        videoSummaryId.toHexString()
      );
      expect(mockMemorizeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          title: 'My Section',
          sourceType: 'video_section',
          source: expect.objectContaining({
            content: expect.objectContaining({
              sections: expect.arrayContaining([
                expect.objectContaining({ id: 'section-1' }),
              ]),
            }),
          }),
        })
      );
      expect(result.id).toBe(createdItem._id.toHexString());
    });

    it('should create memorized item from video concept', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId();
      const videoSummary = createVideoSummaryCache({ _id: videoSummaryId });
      const createdItem = createMemorizedItemDocument({ sourceType: 'video_concept' });

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(videoSummary);
      mockMemorizeRepository.create.mockResolvedValue(createdItem);

      await memorizeService.create({
        userId,
        title: 'My Concept',
        sourceType: 'video_concept',
        videoSummaryId: videoSummaryId.toHexString(),
        conceptId: 'concept-1',
      });

      expect(mockMemorizeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'video_concept',
          source: expect.objectContaining({
            content: expect.objectContaining({
              concept: expect.objectContaining({
                name: 'Test Concept',
                definition: 'A test concept definition',
              }),
            }),
          }),
        })
      );
    });

    it('should create memorized item from system expansion', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId();
      const expansionId = new ObjectId();
      const videoSummary = createVideoSummaryCache({ _id: videoSummaryId });
      const expansion: SystemExpansionDocument = {
        _id: expansionId,
        content: 'Expanded content here',
      };
      const createdItem = createMemorizedItemDocument({ sourceType: 'system_expansion' });

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(videoSummary);
      mockMemorizeRepository.getSystemExpansion.mockResolvedValue(expansion);
      mockMemorizeRepository.create.mockResolvedValue(createdItem);

      await memorizeService.create({
        userId,
        title: 'My Expansion',
        sourceType: 'system_expansion',
        videoSummaryId: videoSummaryId.toHexString(),
        expansionId: expansionId.toHexString(),
      });

      expect(mockMemorizeRepository.getSystemExpansion).toHaveBeenCalledWith(
        expansionId.toHexString()
      );
      expect(mockMemorizeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'system_expansion',
          source: expect.objectContaining({
            content: expect.objectContaining({
              expansion: 'Expanded content here',
            }),
          }),
        })
      );
    });

    it('should throw error when video summary not found', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId().toHexString();

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(null);

      await expect(
        memorizeService.create({
          userId,
          title: 'Test',
          sourceType: 'video_section',
          videoSummaryId,
          sectionIds: ['section-1'],
        })
      ).rejects.toThrow('Video summary not found or not processed');
    });

    it('should throw error when video summary has no summary data', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId();
      const videoSummary = createVideoSummaryCache({ _id: videoSummaryId, summary: null });

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(videoSummary);

      await expect(
        memorizeService.create({
          userId,
          title: 'Test',
          sourceType: 'video_section',
          videoSummaryId: videoSummaryId.toHexString(),
          sectionIds: ['section-1'],
        })
      ).rejects.toThrow('Video summary not found or not processed');
    });

    it('should throw error when section not found', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId();
      const videoSummary = createVideoSummaryCache({ _id: videoSummaryId });

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(videoSummary);

      await expect(
        memorizeService.create({
          userId,
          title: 'Test',
          sourceType: 'video_section',
          videoSummaryId: videoSummaryId.toHexString(),
          sectionIds: ['nonexistent-section'],
        })
      ).rejects.toThrow('No matching sections found');
    });

    it('should throw error when concept not found', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId();
      const videoSummary = createVideoSummaryCache({ _id: videoSummaryId });

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(videoSummary);

      await expect(
        memorizeService.create({
          userId,
          title: 'Test',
          sourceType: 'video_concept',
          videoSummaryId: videoSummaryId.toHexString(),
          conceptId: 'nonexistent-concept',
        })
      ).rejects.toThrow('Concept not found');
    });

    it('should throw error when expansion not found', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId();
      const expansionId = new ObjectId().toHexString();
      const videoSummary = createVideoSummaryCache({ _id: videoSummaryId });

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(videoSummary);
      mockMemorizeRepository.getSystemExpansion.mockResolvedValue(null);

      await expect(
        memorizeService.create({
          userId,
          title: 'Test',
          sourceType: 'system_expansion',
          videoSummaryId: videoSummaryId.toHexString(),
          expansionId,
        })
      ).rejects.toThrow('Expansion not found');
    });

    it('should include timestamp in youtube URL when startSeconds provided', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId();
      const videoSummary = createVideoSummaryCache({ _id: videoSummaryId });
      const createdItem = createMemorizedItemDocument();

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(videoSummary);
      mockMemorizeRepository.create.mockResolvedValue(createdItem);

      await memorizeService.create({
        userId,
        title: 'Test',
        sourceType: 'video_section',
        videoSummaryId: videoSummaryId.toHexString(),
        sectionIds: ['section-1'],
        startSeconds: 30,
      });

      expect(mockMemorizeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({
            youtubeUrl: expect.stringContaining('&t=30'),
          }),
        })
      );
    });

    it('should save with folder, notes, and tags', async () => {
      const userId = new ObjectId().toHexString();
      const videoSummaryId = new ObjectId();
      const folderId = new ObjectId().toHexString();
      const videoSummary = createVideoSummaryCache({ _id: videoSummaryId });
      const createdItem = createMemorizedItemDocument();

      mockMemorizeRepository.getVideoSummaryCache.mockResolvedValue(videoSummary);
      mockMemorizeRepository.create.mockResolvedValue(createdItem);

      await memorizeService.create({
        userId,
        title: 'Test',
        sourceType: 'video_section',
        videoSummaryId: videoSummaryId.toHexString(),
        sectionIds: ['section-1'],
        folderId,
        notes: 'My notes',
        tags: ['tag1', 'tag2'],
      });

      expect(mockMemorizeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId,
          notes: 'My notes',
          tags: ['tag1', 'tag2'],
        })
      );
    });
  });

  describe('update', () => {
    it('should update memorized item title', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId();
      const item = createMemorizedItemDocument({ _id: itemId });
      const updatedItem = createMemorizedItemDocument({ _id: itemId, title: 'Updated Title' });

      mockMemorizeRepository.update.mockResolvedValue(updatedItem);

      const result = await memorizeService.update(userId, itemId.toHexString(), {
        title: 'Updated Title',
      });

      expect(mockMemorizeRepository.update).toHaveBeenCalledWith(userId, itemId.toHexString(), {
        title: 'Updated Title',
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should update memorized item notes', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId();
      const updatedItem = createMemorizedItemDocument({ _id: itemId, notes: 'New notes' });

      mockMemorizeRepository.update.mockResolvedValue(updatedItem);

      const result = await memorizeService.update(userId, itemId.toHexString(), {
        notes: 'New notes',
      });

      expect(result.notes).toBe('New notes');
    });

    it('should update memorized item tags', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId();
      const updatedItem = createMemorizedItemDocument({ _id: itemId, tags: ['new-tag'] });

      mockMemorizeRepository.update.mockResolvedValue(updatedItem);

      const result = await memorizeService.update(userId, itemId.toHexString(), {
        tags: ['new-tag'],
      });

      expect(result.tags).toEqual(['new-tag']);
    });

    it('should update memorized item folderId', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId();
      const folderId = new ObjectId();
      const updatedItem = createMemorizedItemDocument({ _id: itemId, folderId });

      mockMemorizeRepository.update.mockResolvedValue(updatedItem);

      const result = await memorizeService.update(userId, itemId.toHexString(), {
        folderId: folderId.toHexString(),
      });

      expect(result.folderId).toBe(folderId.toHexString());
    });

    it('should throw MemorizedItemNotFoundError when item does not exist', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId().toHexString();

      mockMemorizeRepository.update.mockResolvedValue(null);

      await expect(
        memorizeService.update(userId, itemId, { title: 'New Title' })
      ).rejects.toThrow(MemorizedItemNotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete memorized item', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId().toHexString();

      mockMemorizeRepository.delete.mockResolvedValue(true);

      await expect(memorizeService.delete(userId, itemId)).resolves.not.toThrow();

      expect(mockMemorizeRepository.delete).toHaveBeenCalledWith(userId, itemId);
    });

    it('should throw MemorizedItemNotFoundError when item does not exist', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId().toHexString();

      mockMemorizeRepository.delete.mockResolvedValue(false);

      await expect(memorizeService.delete(userId, itemId)).rejects.toThrow(
        MemorizedItemNotFoundError
      );
    });
  });

  describe('listChats', () => {
    it('should return list of chats for a memorized item', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId().toHexString();
      const chat1 = createUserChatDocument({ title: 'Chat 1' });
      const chat2 = createUserChatDocument({ title: 'Chat 2' });

      mockMemorizeRepository.listChats.mockResolvedValue([chat1, chat2]);

      const result = await memorizeService.listChats(userId, itemId);

      expect(mockMemorizeRepository.listChats).toHaveBeenCalledWith(userId, itemId);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: chat1._id.toHexString(),
        title: 'Chat 1',
        messageCount: 2,
        updatedAt: expect.any(String),
      });
    });

    it('should return empty array when no chats exist', async () => {
      const userId = new ObjectId().toHexString();
      const itemId = new ObjectId().toHexString();

      mockMemorizeRepository.listChats.mockResolvedValue([]);

      const result = await memorizeService.listChats(userId, itemId);

      expect(result).toEqual([]);
    });
  });
});
