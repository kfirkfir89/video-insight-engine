import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, getAuthHeader, type MockContainer } from '../test/helpers.js';

describe('memorize routes', () => {
  let app: FastifyInstance;
  let mockContainer: MockContainer;
  let authHeader: string;

  beforeAll(async () => {
    mockContainer = createMockContainer();
    app = await buildTestApp(mockContainer);
    await app.ready();
    authHeader = await getAuthHeader(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/memorize', () => {
    it('should return list of memorized items', async () => {
      const mockItems = [
        { id: 'item1', title: 'Test Section', sourceType: 'video_section' },
        { id: 'item2', title: 'Test Concept', sourceType: 'video_concept' },
      ];
      mockContainer.memorizeService.list.mockResolvedValue(mockItems);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memorize',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.memorizeService.list).toHaveBeenCalledWith('test-user-id', undefined);
      expect(response.json()).toEqual({ items: mockItems });
    });

    it('should filter by folderId when provided', async () => {
      mockContainer.memorizeService.list.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memorize?folderId=507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.memorizeService.list).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011'
      );
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/memorize',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/memorize/:id', () => {
    it('should return a single memorized item', async () => {
      const mockItem = {
        id: 'item1',
        title: 'Test Section',
        sourceType: 'video_section',
        sectionIds: ['s1', 's2'],
      };
      mockContainer.memorizeService.getById.mockResolvedValue(mockItem);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memorize/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.memorizeService.getById).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011'
      );
      expect(response.json()).toEqual({ item: mockItem });
    });

    it('should return 404 when item not found', async () => {
      const { MemorizedItemNotFoundError } = await import('../utils/errors.js');
      mockContainer.memorizeService.getById.mockRejectedValue(new MemorizedItemNotFoundError());

      const response = await app.inject({
        method: 'GET',
        url: '/api/memorize/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/memorize', () => {
    it('should create a video_section memorized item', async () => {
      const mockItem = {
        id: 'item1',
        title: 'Test Section',
        sourceType: 'video_section',
        sectionIds: ['s1', 's2'],
      };
      mockContainer.memorizeService.create.mockResolvedValue(mockItem);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Test Section',
          sourceType: 'video_section',
          videoSummaryId: '507f1f77bcf86cd799439011',
          sectionIds: ['s1', 's2'],
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.memorizeService.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        title: 'Test Section',
        sourceType: 'video_section',
        videoSummaryId: '507f1f77bcf86cd799439011',
        sectionIds: ['s1', 's2'],
      });
    });

    it('should create a video_concept memorized item', async () => {
      const mockItem = {
        id: 'item2',
        title: 'Test Concept',
        sourceType: 'video_concept',
        conceptId: 'concept1',
      };
      mockContainer.memorizeService.create.mockResolvedValue(mockItem);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Test Concept',
          sourceType: 'video_concept',
          videoSummaryId: '507f1f77bcf86cd799439011',
          conceptId: 'concept1',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.memorizeService.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        title: 'Test Concept',
        sourceType: 'video_concept',
        videoSummaryId: '507f1f77bcf86cd799439011',
        conceptId: 'concept1',
      });
    });

    it('should create a system_expansion memorized item', async () => {
      const mockItem = {
        id: 'item3',
        title: 'Test Expansion',
        sourceType: 'system_expansion',
        expansionId: '507f1f77bcf86cd799439012',
      };
      mockContainer.memorizeService.create.mockResolvedValue(mockItem);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Test Expansion',
          sourceType: 'system_expansion',
          videoSummaryId: '507f1f77bcf86cd799439011',
          expansionId: '507f1f77bcf86cd799439012',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.memorizeService.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        title: 'Test Expansion',
        sourceType: 'system_expansion',
        videoSummaryId: '507f1f77bcf86cd799439011',
        expansionId: '507f1f77bcf86cd799439012',
      });
    });

    it('should accept optional fields', async () => {
      const mockItem = { id: 'item1', title: 'Full Item' };
      mockContainer.memorizeService.create.mockResolvedValue(mockItem);

      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Full Item',
          sourceType: 'video_section',
          videoSummaryId: '507f1f77bcf86cd799439011',
          sectionIds: ['s1'],
          startSeconds: 120,
          endSeconds: 180,
          folderId: '507f1f77bcf86cd799439012',
          tags: ['tag1', 'tag2'],
          notes: 'Some notes about this section',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.memorizeService.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        title: 'Full Item',
        sourceType: 'video_section',
        videoSummaryId: '507f1f77bcf86cd799439011',
        sectionIds: ['s1'],
        startSeconds: 120,
        endSeconds: 180,
        folderId: '507f1f77bcf86cd799439012',
        tags: ['tag1', 'tag2'],
        notes: 'Some notes about this section',
      });
    });

    it('should return 400 when sectionIds missing for video_section type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Missing Sections',
          sourceType: 'video_section',
          videoSummaryId: '507f1f77bcf86cd799439011',
          // missing sectionIds
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when conceptId missing for video_concept type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Missing Concept',
          sourceType: 'video_concept',
          videoSummaryId: '507f1f77bcf86cd799439011',
          // missing conceptId
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when expansionId missing for system_expansion type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Missing Expansion',
          sourceType: 'system_expansion',
          videoSummaryId: '507f1f77bcf86cd799439011',
          // missing expansionId
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          // missing title, sourceType, videoSummaryId
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid sourceType', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Invalid Type',
          sourceType: 'invalid_type',
          videoSummaryId: '507f1f77bcf86cd799439011',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for title exceeding max length', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memorize',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'a'.repeat(201), // exceeds 200 char limit
          sourceType: 'video_section',
          videoSummaryId: '507f1f77bcf86cd799439011',
          sectionIds: ['s1'],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/memorize/:id', () => {
    it('should update a memorized item', async () => {
      const mockItem = { id: 'item1', title: 'Updated Title' };
      mockContainer.memorizeService.update.mockResolvedValue(mockItem);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/memorize/507f1f77bcf86cd799439011',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Updated Title',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.memorizeService.update).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        { title: 'Updated Title' }
      );
      expect(response.json()).toEqual(mockItem);
    });

    it('should update notes', async () => {
      const mockItem = { id: 'item1', notes: 'Updated notes' };
      mockContainer.memorizeService.update.mockResolvedValue(mockItem);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/memorize/507f1f77bcf86cd799439011',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          notes: 'Updated notes',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.memorizeService.update).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        { notes: 'Updated notes' }
      );
    });

    it('should update tags', async () => {
      const mockItem = { id: 'item1', tags: ['new-tag'] };
      mockContainer.memorizeService.update.mockResolvedValue(mockItem);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/memorize/507f1f77bcf86cd799439011',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          tags: ['new-tag'],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.memorizeService.update).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        { tags: ['new-tag'] }
      );
    });

    it('should allow setting folderId to null', async () => {
      mockContainer.memorizeService.update.mockResolvedValue({ id: 'item1' });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/memorize/507f1f77bcf86cd799439011',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          folderId: null,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.memorizeService.update).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        { folderId: null }
      );
    });

    it('should return 404 when item not found', async () => {
      const { MemorizedItemNotFoundError } = await import('../utils/errors.js');
      mockContainer.memorizeService.update.mockRejectedValue(new MemorizedItemNotFoundError());

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/memorize/507f1f77bcf86cd799439011',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          title: 'Updated Title',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/memorize/:id', () => {
    it('should delete a memorized item', async () => {
      mockContainer.memorizeService.delete.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/memorize/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(204);
      expect(mockContainer.memorizeService.delete).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011'
      );
    });

    it('should return 404 when item not found', async () => {
      const { MemorizedItemNotFoundError } = await import('../utils/errors.js');
      mockContainer.memorizeService.delete.mockRejectedValue(new MemorizedItemNotFoundError());

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/memorize/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/memorize/:id/chats', () => {
    it('should return list of chats for a memorized item', async () => {
      const mockItem = { id: 'item1', title: 'Test Item' };
      const mockChats = [
        { id: 'chat1', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'chat2', createdAt: '2024-01-02T00:00:00.000Z' },
      ];
      mockContainer.memorizeService.getById.mockResolvedValue(mockItem);
      mockContainer.memorizeService.listChats.mockResolvedValue(mockChats);

      const response = await app.inject({
        method: 'GET',
        url: '/api/memorize/507f1f77bcf86cd799439011/chats',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.memorizeService.getById).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011'
      );
      expect(mockContainer.memorizeService.listChats).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011'
      );
      expect(response.json()).toEqual({ chats: mockChats });
    });

    it('should return 404 when memorized item not found', async () => {
      const { MemorizedItemNotFoundError } = await import('../utils/errors.js');
      mockContainer.memorizeService.getById.mockRejectedValue(new MemorizedItemNotFoundError());

      const response = await app.inject({
        method: 'GET',
        url: '/api/memorize/507f1f77bcf86cd799439011/chats',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
