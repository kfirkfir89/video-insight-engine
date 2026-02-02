import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { MemorizeRepository, CreateMemorizedItemData, MemorizedItemDocument } from '../memorize.repository.js';

describe('MemorizeRepository', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repository: MemorizeRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test');
    repository = new MemorizeRepository(db);
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.collection('memorizedItems').deleteMany({});
    await db.collection('userChats').deleteMany({});
    await db.collection('videoSummaryCache').deleteMany({});
    await db.collection('systemExpansionCache').deleteMany({});
  });

  // Test data factory
  function createMemorizedItemData(overrides: Partial<CreateMemorizedItemData> = {}): CreateMemorizedItemData {
    const videoSummaryId = new ObjectId();
    return {
      userId: new ObjectId().toString(),
      title: 'Test Memorized Item',
      sourceType: 'video_section',
      source: {
        videoSummaryId,
        youtubeId: 'dQw4w9WgXcQ',
        videoTitle: 'Test Video',
        videoThumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        startSeconds: 0,
        endSeconds: 60,
        sectionIds: ['section-1'],
        content: {
          sections: [
            {
              id: 'section-1',
              timestamp: '0:00',
              title: 'Introduction',
              summary: 'This is the introduction.',
              bullets: ['Point 1', 'Point 2'],
            },
          ],
        },
      },
      ...overrides,
    };
  }

  describe('create', () => {
    it('should create a memorized item with required fields', async () => {
      const userId = new ObjectId().toString();
      const data = createMemorizedItemData({ userId });

      const item = await repository.create(data);

      expect(item._id).toBeDefined();
      expect(item.userId.toString()).toBe(userId);
      expect(item.title).toBe('Test Memorized Item');
      expect(item.sourceType).toBe('video_section');
      expect(item.source.youtubeId).toBe('dQw4w9WgXcQ');
      expect(item.folderId).toBeNull();
      expect(item.notes).toBeNull();
      expect(item.tags).toEqual([]);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
    });

    it('should create item with optional fields', async () => {
      const folderId = new ObjectId().toString();
      const data = createMemorizedItemData({
        folderId,
        notes: 'My notes',
        tags: ['important', 'review'],
      });

      const item = await repository.create(data);

      expect(item.folderId?.toString()).toBe(folderId);
      expect(item.notes).toBe('My notes');
      expect(item.tags).toEqual(['important', 'review']);
    });

    it('should create item with video_concept sourceType', async () => {
      const videoSummaryId = new ObjectId();
      const data = createMemorizedItemData({
        sourceType: 'video_concept',
        source: {
          videoSummaryId,
          youtubeId: 'test123',
          videoTitle: 'Test',
          videoThumbnail: 'thumb.jpg',
          youtubeUrl: 'https://youtube.com/watch?v=test123',
          content: {
            concept: {
              name: 'React Hooks',
              definition: 'Functions that let you use state and other React features.',
            },
          },
        },
      });

      const item = await repository.create(data);

      expect(item.sourceType).toBe('video_concept');
      expect(item.source.content.concept?.name).toBe('React Hooks');
    });

    it('should create item with system_expansion sourceType', async () => {
      const videoSummaryId = new ObjectId();
      const expansionId = new ObjectId();
      const data = createMemorizedItemData({
        sourceType: 'system_expansion',
        source: {
          videoSummaryId,
          youtubeId: 'test123',
          videoTitle: 'Test',
          videoThumbnail: 'thumb.jpg',
          youtubeUrl: 'https://youtube.com/watch?v=test123',
          expansionId,
          content: {
            expansion: 'Detailed explanation of the topic...',
          },
        },
      });

      const item = await repository.create(data);

      expect(item.sourceType).toBe('system_expansion');
      expect(item.source.expansionId?.toString()).toBe(expansionId.toString());
    });
  });

  describe('findById', () => {
    it('should find item by id and userId', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      const found = await repository.findById(userId, created._id.toString());

      expect(found).not.toBeNull();
      expect(found?._id.toString()).toBe(created._id.toString());
    });

    it('should return null when item not found', async () => {
      const userId = new ObjectId().toString();
      const itemId = new ObjectId().toString();

      const found = await repository.findById(userId, itemId);

      expect(found).toBeNull();
    });

    it('should return null when userId does not match', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      const found = await repository.findById(otherUserId, created._id.toString());

      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all items for a user', async () => {
      const userId = new ObjectId().toString();
      await repository.create(createMemorizedItemData({ userId, title: 'Item 1' }));
      await repository.create(createMemorizedItemData({ userId, title: 'Item 2' }));

      const items = await repository.list(userId);

      expect(items).toHaveLength(2);
    });

    it('should filter by folderId', async () => {
      const userId = new ObjectId().toString();
      const folderId = new ObjectId().toString();
      await repository.create(createMemorizedItemData({ userId, folderId }));
      await repository.create(createMemorizedItemData({ userId })); // No folder

      const folderItems = await repository.list(userId, folderId);
      const rootItems = await repository.list(userId, ''); // Empty string for null folderId

      // folderId: '' should match null
      expect(folderItems).toHaveLength(1);
    });

    it('should apply limit and offset', async () => {
      const userId = new ObjectId().toString();
      for (let i = 0; i < 10; i++) {
        await repository.create(createMemorizedItemData({ userId, title: `Item ${i}` }));
      }

      const firstPage = await repository.list(userId, undefined, { limit: 3, offset: 0 });
      const secondPage = await repository.list(userId, undefined, { limit: 3, offset: 3 });

      expect(firstPage).toHaveLength(3);
      expect(secondPage).toHaveLength(3);
      expect(firstPage[0]._id.toString()).not.toBe(secondPage[0]._id.toString());
    });

    it('should sort by createdAt descending', async () => {
      const userId = new ObjectId().toString();
      const item1 = await repository.create(createMemorizedItemData({ userId, title: 'First' }));
      await new Promise(resolve => setTimeout(resolve, 10));
      const item2 = await repository.create(createMemorizedItemData({ userId, title: 'Second' }));

      const items = await repository.list(userId);

      expect(items[0]._id.toString()).toBe(item2._id.toString()); // Most recent first
      expect(items[1]._id.toString()).toBe(item1._id.toString());
    });

    it('should not return items from other users', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();
      await repository.create(createMemorizedItemData({ userId }));
      await repository.create(createMemorizedItemData({ userId: otherUserId }));

      const items = await repository.list(userId);

      expect(items).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update item title', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      const updated = await repository.update(userId, created._id.toString(), {
        title: 'New Title',
      });

      expect(updated?.title).toBe('New Title');
    });

    it('should update item notes', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      const updated = await repository.update(userId, created._id.toString(), {
        notes: 'Updated notes',
      });

      expect(updated?.notes).toBe('Updated notes');
    });

    it('should update item tags', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      const updated = await repository.update(userId, created._id.toString(), {
        tags: ['new-tag', 'another-tag'],
      });

      expect(updated?.tags).toEqual(['new-tag', 'another-tag']);
    });

    it('should update item folderId', async () => {
      const userId = new ObjectId().toString();
      const newFolderId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      const updated = await repository.update(userId, created._id.toString(), {
        folderId: newFolderId,
      });

      expect(updated?.folderId?.toString()).toBe(newFolderId);
    });

    it('should set folderId to null', async () => {
      const userId = new ObjectId().toString();
      const folderId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId, folderId }));

      const updated = await repository.update(userId, created._id.toString(), {
        folderId: null,
      });

      expect(updated?.folderId).toBeNull();
    });

    it('should return null when item not found', async () => {
      const userId = new ObjectId().toString();
      const nonExistentId = new ObjectId().toString();

      const updated = await repository.update(userId, nonExistentId, { title: 'New' });

      expect(updated).toBeNull();
    });

    it('should not update items from other users', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      const updated = await repository.update(otherUserId, created._id.toString(), {
        title: 'Hacked',
      });

      expect(updated).toBeNull();
      const original = await repository.findById(userId, created._id.toString());
      expect(original?.title).toBe('Test Memorized Item');
    });
  });

  describe('delete', () => {
    it('should delete item and return true', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      const deleted = await repository.delete(userId, created._id.toString());

      expect(deleted).toBe(true);
      const found = await repository.findById(userId, created._id.toString());
      expect(found).toBeNull();
    });

    it('should delete associated chats', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      // Create associated chat
      await db.collection('userChats').insertOne({
        userId: new ObjectId(userId),
        memorizedItemId: created._id,
        title: 'Test Chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await repository.delete(userId, created._id.toString());

      const chats = await db.collection('userChats').find({ memorizedItemId: created._id }).toArray();
      expect(chats).toHaveLength(0);
    });

    it('should return false when item not found', async () => {
      const userId = new ObjectId().toString();
      const nonExistentId = new ObjectId().toString();

      const deleted = await repository.delete(userId, nonExistentId);

      expect(deleted).toBe(false);
    });

    it('should not delete items from other users', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      const deleted = await repository.delete(otherUserId, created._id.toString());

      expect(deleted).toBe(false);
      const found = await repository.findById(userId, created._id.toString());
      expect(found).not.toBeNull();
    });
  });

  describe('listChats', () => {
    it('should list chats for a memorized item', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      await db.collection('userChats').insertOne({
        userId: new ObjectId(userId),
        memorizedItemId: created._id,
        title: 'Chat 1',
        messages: [{ role: 'user', content: 'Hello', createdAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.collection('userChats').insertOne({
        userId: new ObjectId(userId),
        memorizedItemId: created._id,
        title: 'Chat 2',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(Date.now() + 1000),
      });

      const chats = await repository.listChats(userId, created._id.toString());

      expect(chats).toHaveLength(2);
    });

    it('should sort chats by updatedAt descending', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      await db.collection('userChats').insertOne({
        userId: new ObjectId(userId),
        memorizedItemId: created._id,
        title: 'Older Chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date('2024-01-01'),
      });

      await db.collection('userChats').insertOne({
        userId: new ObjectId(userId),
        memorizedItemId: created._id,
        title: 'Newer Chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date('2024-06-01'),
      });

      const chats = await repository.listChats(userId, created._id.toString());

      expect(chats[0].title).toBe('Newer Chat');
      expect(chats[1].title).toBe('Older Chat');
    });

    it('should not return chats from other users', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();
      const created = await repository.create(createMemorizedItemData({ userId }));

      await db.collection('userChats').insertOne({
        userId: new ObjectId(otherUserId),
        memorizedItemId: created._id,
        title: "Other User's Chat",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const chats = await repository.listChats(userId, created._id.toString());

      expect(chats).toHaveLength(0);
    });
  });

  describe('getVideoSummaryCache', () => {
    it('should find video summary cache by id', async () => {
      const cacheId = new ObjectId();
      await db.collection('videoSummaryCache').insertOne({
        _id: cacheId,
        youtubeId: 'test123',
        title: 'Test Video',
        thumbnailUrl: 'thumb.jpg',
        url: 'https://youtube.com/watch?v=test123',
        summary: {
          sections: [],
          concepts: [],
        },
      });

      const cache = await repository.getVideoSummaryCache(cacheId.toString());

      expect(cache).not.toBeNull();
      expect(cache?.youtubeId).toBe('test123');
    });

    it('should return null when cache not found', async () => {
      const nonExistentId = new ObjectId().toString();

      const cache = await repository.getVideoSummaryCache(nonExistentId);

      expect(cache).toBeNull();
    });
  });

  describe('getSystemExpansion', () => {
    it('should find system expansion by id', async () => {
      const expansionId = new ObjectId();
      await db.collection('systemExpansionCache').insertOne({
        _id: expansionId,
        content: 'Detailed explanation of the concept...',
      });

      const expansion = await repository.getSystemExpansion(expansionId.toString());

      expect(expansion).not.toBeNull();
      expect(expansion?.content).toBe('Detailed explanation of the concept...');
    });

    it('should return null when expansion not found', async () => {
      const nonExistentId = new ObjectId().toString();

      const expansion = await repository.getSystemExpansion(nonExistentId);

      expect(expansion).toBeNull();
    });
  });
});
