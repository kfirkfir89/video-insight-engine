import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { FolderRepository, FolderDocument, CreateFolderData } from '../folder.repository.js';

describe('FolderRepository', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repository: FolderRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test');
    repository = new FolderRepository(db);
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.collection('folders').deleteMany({});
    await db.collection('userVideos').deleteMany({});
    await db.collection('memorizedItems').deleteMany({});
    await db.collection('userChats').deleteMany({});
  });

  // Test data factory
  function createFolderData(overrides: Partial<CreateFolderData> = {}): CreateFolderData {
    return {
      userId: new ObjectId().toString(),
      name: 'Test Folder',
      type: 'summarized',
      ...overrides,
    };
  }

  describe('create', () => {
    it('should create a folder with required fields', async () => {
      const userId = new ObjectId().toString();
      const data = createFolderData({ userId, name: 'My Folder' });

      const folder = await repository.create(data, '/my-folder', 0, 0);

      expect(folder._id).toBeDefined();
      expect(folder.userId.toString()).toBe(userId);
      expect(folder.name).toBe('My Folder');
      expect(folder.type).toBe('summarized');
      expect(folder.path).toBe('/my-folder');
      expect(folder.level).toBe(0);
      expect(folder.order).toBe(0);
      expect(folder.parentId).toBeNull();
      expect(folder.color).toBeNull();
      expect(folder.icon).toBeNull();
      expect(folder.createdAt).toBeInstanceOf(Date);
      expect(folder.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a folder with optional fields', async () => {
      const parentId = new ObjectId().toString();
      const data = createFolderData({
        parentId,
        color: '#ff0000',
        icon: 'folder',
      });

      const folder = await repository.create(data, '/parent/child', 1, 2);

      expect(folder.parentId?.toString()).toBe(parentId);
      expect(folder.color).toBe('#ff0000');
      expect(folder.icon).toBe('folder');
      expect(folder.level).toBe(1);
      expect(folder.order).toBe(2);
    });

    it('should create memorized folder type', async () => {
      const data = createFolderData({ type: 'memorized' });

      const folder = await repository.create(data, '/memorized', 0, 0);

      expect(folder.type).toBe('memorized');
    });
  });

  describe('findById', () => {
    it('should find folder by id and userId', async () => {
      const userId = new ObjectId().toString();
      const data = createFolderData({ userId });
      const created = await repository.create(data, '/test', 0, 0);

      const found = await repository.findById(userId, created._id.toString());

      expect(found).not.toBeNull();
      expect(found?._id.toString()).toBe(created._id.toString());
    });

    it('should return null when folder not found', async () => {
      const userId = new ObjectId().toString();
      const folderId = new ObjectId().toString();

      const found = await repository.findById(userId, folderId);

      expect(found).toBeNull();
    });

    it('should return null when userId does not match', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();
      const data = createFolderData({ userId });
      const created = await repository.create(data, '/test', 0, 0);

      const found = await repository.findById(otherUserId, created._id.toString());

      expect(found).toBeNull();
    });
  });

  describe('findByPath', () => {
    it('should find folder by path and userId', async () => {
      const userId = new ObjectId().toString();
      const data = createFolderData({ userId });
      await repository.create(data, '/unique-path', 0, 0);

      const found = await repository.findByPath(userId, '/unique-path');

      expect(found).not.toBeNull();
      expect(found?.path).toBe('/unique-path');
    });

    it('should return null when path not found', async () => {
      const userId = new ObjectId().toString();

      const found = await repository.findByPath(userId, '/nonexistent');

      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all folders for a user', async () => {
      const userId = new ObjectId().toString();
      await repository.create(createFolderData({ userId, name: 'Folder 1' }), '/folder1', 0, 0);
      await repository.create(createFolderData({ userId, name: 'Folder 2' }), '/folder2', 0, 1);

      const folders = await repository.list(userId);

      expect(folders).toHaveLength(2);
    });

    it('should filter by type', async () => {
      const userId = new ObjectId().toString();
      await repository.create(createFolderData({ userId, type: 'summarized' }), '/sum', 0, 0);
      await repository.create(createFolderData({ userId, type: 'memorized' }), '/mem', 0, 1);

      const summarized = await repository.list(userId, 'summarized');
      const memorized = await repository.list(userId, 'memorized');

      expect(summarized).toHaveLength(1);
      expect(summarized[0].type).toBe('summarized');
      expect(memorized).toHaveLength(1);
      expect(memorized[0].type).toBe('memorized');
    });

    it('should not return folders from other users', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();
      await repository.create(createFolderData({ userId }), '/mine', 0, 0);
      await repository.create(createFolderData({ userId: otherUserId }), '/theirs', 0, 0);

      const folders = await repository.list(userId);

      expect(folders).toHaveLength(1);
    });

    it('should sort by path and order', async () => {
      const userId = new ObjectId().toString();
      await repository.create(createFolderData({ userId, name: 'B' }), '/b', 0, 1);
      await repository.create(createFolderData({ userId, name: 'A' }), '/a', 0, 0);
      await repository.create(createFolderData({ userId, name: 'A-child' }), '/a/child', 1, 0);

      const folders = await repository.list(userId);

      expect(folders[0].path).toBe('/a');
      expect(folders[1].path).toBe('/a/child');
      expect(folders[2].path).toBe('/b');
    });
  });

  describe('update', () => {
    it('should update folder name', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createFolderData({ userId }), '/test', 0, 0);

      await repository.update(created._id.toString(), { name: 'New Name' });

      const updated = await repository.findById(userId, created._id.toString());
      expect(updated?.name).toBe('New Name');
    });

    it('should update folder color and icon', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createFolderData({ userId }), '/test', 0, 0);

      await repository.update(created._id.toString(), {
        color: '#00ff00',
        icon: 'star',
      });

      const updated = await repository.findById(userId, created._id.toString());
      expect(updated?.color).toBe('#00ff00');
      expect(updated?.icon).toBe('star');
    });

    it('should update folder parentId', async () => {
      const userId = new ObjectId().toString();
      const parent = await repository.create(createFolderData({ userId }), '/parent', 0, 0);
      const child = await repository.create(createFolderData({ userId }), '/child', 0, 1);

      await repository.update(child._id.toString(), {
        parentId: parent._id.toString(),
      });

      const updated = await repository.findById(userId, child._id.toString());
      expect(updated?.parentId?.toString()).toBe(parent._id.toString());
    });

    it('should update path and level', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createFolderData({ userId }), '/old', 0, 0);

      await repository.update(created._id.toString(), {
        path: '/new/path',
        level: 2,
      });

      const updated = await repository.findById(userId, created._id.toString());
      expect(updated?.path).toBe('/new/path');
      expect(updated?.level).toBe(2);
    });

    it('should update updatedAt timestamp', async () => {
      const userId = new ObjectId().toString();
      const created = await repository.create(createFolderData({ userId }), '/test', 0, 0);
      const originalUpdatedAt = created.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      await repository.update(created._id.toString(), { name: 'Updated' });

      const updated = await repository.findById(userId, created._id.toString());
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('getMaxSiblingOrder', () => {
    it('should return 0 when no siblings exist', async () => {
      const userId = new ObjectId().toString();

      const order = await repository.getMaxSiblingOrder(userId, 'summarized', null);

      expect(order).toBe(0);
    });

    it('should return next order value', async () => {
      const userId = new ObjectId().toString();
      await repository.create(createFolderData({ userId }), '/folder1', 0, 0);
      await repository.create(createFolderData({ userId }), '/folder2', 0, 5);

      const order = await repository.getMaxSiblingOrder(userId, 'summarized', null);

      expect(order).toBe(6);
    });

    it('should consider parent folder when calculating order', async () => {
      const userId = new ObjectId().toString();
      const parent = await repository.create(createFolderData({ userId }), '/parent', 0, 0);
      await repository.create(
        createFolderData({ userId, parentId: parent._id.toString() }),
        '/parent/child',
        1,
        3
      );

      const rootOrder = await repository.getMaxSiblingOrder(userId, 'summarized', null);
      const childOrder = await repository.getMaxSiblingOrder(
        userId,
        'summarized',
        parent._id.toString()
      );

      expect(rootOrder).toBe(1); // Only parent is at root
      expect(childOrder).toBe(4); // Child has order 3
    });
  });

  describe('findDescendantsByPath', () => {
    it('should find all descendants by path prefix', async () => {
      const userId = new ObjectId().toString();
      await repository.create(createFolderData({ userId }), '/parent', 0, 0);
      await repository.create(createFolderData({ userId }), '/parent/child1', 1, 0);
      await repository.create(createFolderData({ userId }), '/parent/child2', 1, 1);
      await repository.create(createFolderData({ userId }), '/parent/child1/grandchild', 2, 0);
      await repository.create(createFolderData({ userId }), '/other', 0, 1);

      const descendants = await repository.findDescendantsByPath(userId, '/parent');

      expect(descendants).toHaveLength(3);
      descendants.forEach(d => {
        expect(d.path).toMatch(/^\/parent\//);
      });
    });

    it('should return empty array when no descendants', async () => {
      const userId = new ObjectId().toString();
      await repository.create(createFolderData({ userId }), '/lonely', 0, 0);

      const descendants = await repository.findDescendantsByPath(userId, '/lonely');

      expect(descendants).toHaveLength(0);
    });

    it('should escape special regex characters in path', async () => {
      const userId = new ObjectId().toString();
      await repository.create(createFolderData({ userId }), '/test.folder', 0, 0);
      await repository.create(createFolderData({ userId }), '/test.folder/child', 1, 0);

      const descendants = await repository.findDescendantsByPath(userId, '/test.folder');

      expect(descendants).toHaveLength(1);
    });
  });

  describe('bulkUpdatePaths', () => {
    it('should update multiple folder paths', async () => {
      const userId = new ObjectId().toString();
      const folder1 = await repository.create(createFolderData({ userId }), '/old1', 0, 0);
      const folder2 = await repository.create(createFolderData({ userId }), '/old2', 0, 1);

      await repository.bulkUpdatePaths([
        { id: folder1._id.toString(), path: '/new1', level: 1 },
        { id: folder2._id.toString(), path: '/new2', level: 2 },
      ]);

      const updated1 = await repository.findById(userId, folder1._id.toString());
      const updated2 = await repository.findById(userId, folder2._id.toString());

      expect(updated1?.path).toBe('/new1');
      expect(updated1?.level).toBe(1);
      expect(updated2?.path).toBe('/new2');
      expect(updated2?.level).toBe(2);
    });

    it('should handle empty updates array', async () => {
      await expect(repository.bulkUpdatePaths([])).resolves.toBeUndefined();
    });
  });

  describe('getAllDescendantIds', () => {
    it('should get all descendant folder ids', async () => {
      const userId = new ObjectId().toString();
      const parent = await repository.create(createFolderData({ userId }), '/parent', 0, 0);
      const child1 = await repository.create(
        createFolderData({ userId, parentId: parent._id.toString() }),
        '/parent/child1',
        1,
        0
      );
      await repository.create(
        createFolderData({ userId, parentId: child1._id.toString() }),
        '/parent/child1/grandchild',
        2,
        0
      );

      const descendantIds = await repository.getAllDescendantIds(userId, parent._id.toString());

      expect(descendantIds).toHaveLength(2);
    });

    it('should return empty array when no descendants', async () => {
      const userId = new ObjectId().toString();
      const folder = await repository.create(createFolderData({ userId }), '/lonely', 0, 0);

      const descendantIds = await repository.getAllDescendantIds(userId, folder._id.toString());

      expect(descendantIds).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should delete folders by ids', async () => {
      const userId = new ObjectId().toString();
      const folder1 = await repository.create(createFolderData({ userId }), '/folder1', 0, 0);
      const folder2 = await repository.create(createFolderData({ userId }), '/folder2', 0, 1);

      await repository.delete([folder1._id, folder2._id], userId);

      const remaining = await repository.list(userId);
      expect(remaining).toHaveLength(0);
    });

    it('should only delete folders for the specified user', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();
      const myFolder = await repository.create(createFolderData({ userId }), '/mine', 0, 0);
      await repository.create(createFolderData({ userId: otherUserId }), '/theirs', 0, 0);

      await repository.delete([myFolder._id], userId);

      const myFolders = await repository.list(userId);
      const theirFolders = await repository.list(otherUserId);
      expect(myFolders).toHaveLength(0);
      expect(theirFolders).toHaveLength(1);
    });
  });

  describe('deleteContentInFolders', () => {
    it('should delete userVideos in folders', async () => {
      const userId = new ObjectId().toString();
      const folder = await repository.create(createFolderData({ userId }), '/folder', 0, 0);

      await db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        folderId: folder._id,
        youtubeId: 'test123',
        videoSummaryId: new ObjectId(),
        status: 'completed',
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await repository.deleteContentInFolders([folder._id], userId);

      const videos = await db.collection('userVideos').find({ userId: new ObjectId(userId) }).toArray();
      expect(videos).toHaveLength(0);
    });

    it('should delete memorizedItems and their chats', async () => {
      const userId = new ObjectId().toString();
      const folder = await repository.create(createFolderData({ userId }), '/folder', 0, 0);
      const memorizedItemId = new ObjectId();

      await db.collection('memorizedItems').insertOne({
        _id: memorizedItemId,
        userId: new ObjectId(userId),
        folderId: folder._id,
        title: 'Test Item',
        sourceType: 'video_section',
        source: {},
        notes: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.collection('userChats').insertOne({
        userId: new ObjectId(userId),
        memorizedItemId,
        title: 'Test Chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await repository.deleteContentInFolders([folder._id], userId);

      const items = await db.collection('memorizedItems').find({ userId: new ObjectId(userId) }).toArray();
      const chats = await db.collection('userChats').find({ userId: new ObjectId(userId) }).toArray();
      expect(items).toHaveLength(0);
      expect(chats).toHaveLength(0);
    });
  });

  describe('moveContentToRoot', () => {
    it('should move userVideos to root (null folderId)', async () => {
      const userId = new ObjectId().toString();
      const folder = await repository.create(createFolderData({ userId }), '/folder', 0, 0);

      await db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        folderId: folder._id,
        youtubeId: 'test123',
        videoSummaryId: new ObjectId(),
        status: 'completed',
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await repository.moveContentToRoot([folder._id], userId);

      const video = await db.collection('userVideos').findOne({ youtubeId: 'test123' });
      expect(video?.folderId).toBeNull();
    });

    it('should move memorizedItems to root', async () => {
      const userId = new ObjectId().toString();
      const folder = await repository.create(createFolderData({ userId }), '/folder', 0, 0);

      await db.collection('memorizedItems').insertOne({
        userId: new ObjectId(userId),
        folderId: folder._id,
        title: 'Test Item',
        sourceType: 'video_section',
        source: {},
        notes: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await repository.moveContentToRoot([folder._id], userId);

      const item = await db.collection('memorizedItems').findOne({ title: 'Test Item' });
      expect(item?.folderId).toBeNull();
    });
  });
});
