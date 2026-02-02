import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { buildTestApp, createMockContainer, type MockContainer } from '../test/helpers.js';

// The default internal secret from config
const INTERNAL_SECRET = 'dev-internal-secret-change-me';

describe('internal routes', () => {
  let app: FastifyInstance;
  let mockContainer: MockContainer;

  beforeAll(async () => {
    mockContainer = createMockContainer();
    app = await buildTestApp(mockContainer);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /internal/status', () => {
    describe('authentication', () => {
      it('should return 401 when x-internal-secret header is missing', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: { 'content-type': 'application/json' },
          payload: {
            type: 'video.status',
            payload: {
              videoSummaryId: '507f1f77bcf86cd799439011',
              status: 'completed',
            },
          },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({ error: 'Unauthorized' });
      });

      it('should return 401 when x-internal-secret is invalid', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': 'wrong-secret',
          },
          payload: {
            type: 'video.status',
            payload: {
              videoSummaryId: '507f1f77bcf86cd799439011',
              status: 'completed',
            },
          },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({ error: 'Unauthorized' });
      });
    });

    describe('video.status events', () => {
      it('should process video.status event and update userVideos', async () => {
        const videoSummaryId = new ObjectId().toHexString();
        const mockUserVideos = [
          { _id: new ObjectId(), userId: new ObjectId(), videoSummaryId: new ObjectId(videoSummaryId) },
        ];

        // Mock MongoDB operations
        const mockUpdateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 });
        const mockFind = vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockUserVideos),
        });
        const mockCollection = vi.fn().mockReturnValue({
          updateMany: mockUpdateMany,
          find: mockFind,
        });

        app.mongo.db.collection = mockCollection;

        // Mock broadcast function
        const mockBroadcast = vi.fn();
        app.broadcast = mockBroadcast;

        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'video.status',
            payload: {
              videoSummaryId,
              status: 'completed',
            },
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ received: true });

        // Verify updateMany was called
        expect(mockCollection).toHaveBeenCalledWith('userVideos');
        expect(mockUpdateMany).toHaveBeenCalledWith(
          { videoSummaryId: new ObjectId(videoSummaryId) },
          expect.objectContaining({
            $set: expect.objectContaining({ status: 'completed' }),
          })
        );
      });

      it('should broadcast to specific userId when provided', async () => {
        const videoSummaryId = new ObjectId().toHexString();
        const userId = 'test-user-123';

        // Mock MongoDB operations
        const mockUpdateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 });
        const mockCollection = vi.fn().mockReturnValue({
          updateMany: mockUpdateMany,
        });
        app.mongo.db.collection = mockCollection;

        // Mock broadcast function
        const mockBroadcast = vi.fn();
        app.broadcast = mockBroadcast;

        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'video.status',
            payload: {
              videoSummaryId,
              userId,
              status: 'processing',
              progress: 50,
            },
          },
        });

        expect(response.statusCode).toBe(200);

        // Verify broadcast was called with userId
        expect(mockBroadcast).toHaveBeenCalledWith(userId, {
          type: 'video.status',
          payload: {
            videoSummaryId,
            userId,
            status: 'processing',
            progress: 50,
          },
        });
      });

      it('should accept all valid status values', async () => {
        const statuses = ['pending', 'processing', 'completed', 'failed'];
        const videoSummaryId = new ObjectId().toHexString();

        // Mock MongoDB operations
        const mockUpdateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 });
        const mockFind = vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        });
        const mockCollection = vi.fn().mockReturnValue({
          updateMany: mockUpdateMany,
          find: mockFind,
        });
        app.mongo.db.collection = mockCollection;
        app.broadcast = vi.fn();

        for (const status of statuses) {
          const response = await app.inject({
            method: 'POST',
            url: '/internal/status',
            headers: {
              'content-type': 'application/json',
              'x-internal-secret': INTERNAL_SECRET,
            },
            payload: {
              type: 'video.status',
              payload: {
                videoSummaryId,
                status,
              },
            },
          });

          expect(response.statusCode).toBe(200);
        }
      });

      it('should accept optional message and error fields', async () => {
        const videoSummaryId = new ObjectId().toHexString();

        // Mock MongoDB operations
        const mockUpdateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 });
        const mockFind = vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        });
        const mockCollection = vi.fn().mockReturnValue({
          updateMany: mockUpdateMany,
          find: mockFind,
        });
        app.mongo.db.collection = mockCollection;
        app.broadcast = vi.fn();

        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'video.status',
            payload: {
              videoSummaryId,
              status: 'failed',
              message: 'Processing failed',
              error: 'Transcript not available',
            },
          },
        });

        expect(response.statusCode).toBe(200);
      });
    });

    describe('expansion.status events', () => {
      it('should process expansion.status event for section', async () => {
        const videoSummaryId = new ObjectId().toHexString();
        const mockUserVideos = [
          { _id: new ObjectId(), userId: new ObjectId() },
        ];

        // Mock MongoDB operations
        const mockFind = vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockUserVideos),
        });
        const mockCollection = vi.fn().mockReturnValue({
          find: mockFind,
        });
        app.mongo.db.collection = mockCollection;

        const mockBroadcast = vi.fn();
        app.broadcast = mockBroadcast;

        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'expansion.status',
            payload: {
              videoSummaryId,
              targetType: 'section',
              targetId: 'section-123',
              status: 'completed',
            },
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ received: true });

        // Verify find was called to get users
        expect(mockCollection).toHaveBeenCalledWith('userVideos');
        expect(mockFind).toHaveBeenCalledWith({
          videoSummaryId: new ObjectId(videoSummaryId),
        });

        // Verify broadcast was called for each user
        expect(mockBroadcast).toHaveBeenCalled();
      });

      it('should process expansion.status event for concept', async () => {
        const videoSummaryId = new ObjectId().toHexString();
        const mockUserVideos = [
          { _id: new ObjectId(), userId: new ObjectId() },
        ];

        // Mock MongoDB operations
        const mockFind = vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockUserVideos),
        });
        const mockCollection = vi.fn().mockReturnValue({
          find: mockFind,
        });
        app.mongo.db.collection = mockCollection;
        app.broadcast = vi.fn();

        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'expansion.status',
            payload: {
              videoSummaryId,
              targetType: 'concept',
              targetId: 'concept-456',
              status: 'processing',
            },
          },
        });

        expect(response.statusCode).toBe(200);
      });

      it('should broadcast to all users who have the video', async () => {
        const videoSummaryId = new ObjectId().toHexString();
        const user1Id = new ObjectId();
        const user2Id = new ObjectId();
        const mockUserVideos = [
          { _id: new ObjectId(), userId: user1Id, videoSummaryId: new ObjectId(videoSummaryId) },
          { _id: new ObjectId(), userId: user2Id, videoSummaryId: new ObjectId(videoSummaryId) },
        ];

        // Mock MongoDB operations
        const mockFind = vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockUserVideos),
        });
        const mockCollection = vi.fn().mockReturnValue({
          find: mockFind,
        });
        app.mongo.db.collection = mockCollection;

        const mockBroadcast = vi.fn();
        app.broadcast = mockBroadcast;

        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'expansion.status',
            payload: {
              videoSummaryId,
              targetType: 'section',
              targetId: 'section-123',
              status: 'completed',
            },
          },
        });

        expect(response.statusCode).toBe(200);

        // Verify broadcast was called for each user
        expect(mockBroadcast).toHaveBeenCalledTimes(2);
        expect(mockBroadcast).toHaveBeenCalledWith(
          user1Id.toHexString(),
          expect.objectContaining({ type: 'expansion.status' })
        );
        expect(mockBroadcast).toHaveBeenCalledWith(
          user2Id.toHexString(),
          expect.objectContaining({ type: 'expansion.status' })
        );
      });

      it('should accept optional error field', async () => {
        const videoSummaryId = new ObjectId().toHexString();

        // Mock MongoDB operations
        const mockFind = vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        });
        const mockCollection = vi.fn().mockReturnValue({
          find: mockFind,
        });
        app.mongo.db.collection = mockCollection;
        app.broadcast = vi.fn();

        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'expansion.status',
            payload: {
              videoSummaryId,
              targetType: 'section',
              targetId: 'section-123',
              status: 'failed',
              error: 'Expansion generation failed',
            },
          },
        });

        expect(response.statusCode).toBe(200);
      });
    });

    describe('validation', () => {
      it('should return 400 for invalid event type', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'invalid.type',
            payload: {
              videoSummaryId: '507f1f77bcf86cd799439011',
              status: 'completed',
            },
          },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toHaveProperty('error', 'Bad Request');
      });

      it('should return 400 for invalid status value', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'video.status',
            payload: {
              videoSummaryId: '507f1f77bcf86cd799439011',
              status: 'invalid-status',
            },
          },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for missing videoSummaryId', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'video.status',
            payload: {
              status: 'completed',
            },
          },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for missing status', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'video.status',
            payload: {
              videoSummaryId: '507f1f77bcf86cd799439011',
            },
          },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for invalid targetType in expansion.status', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'expansion.status',
            payload: {
              videoSummaryId: '507f1f77bcf86cd799439011',
              targetType: 'invalid-target',
              targetId: 'test-123',
              status: 'completed',
            },
          },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for missing targetId in expansion.status', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {
            type: 'expansion.status',
            payload: {
              videoSummaryId: '507f1f77bcf86cd799439011',
              targetType: 'section',
              status: 'completed',
            },
          },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for empty payload', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/internal/status',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          payload: {},
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });
});
