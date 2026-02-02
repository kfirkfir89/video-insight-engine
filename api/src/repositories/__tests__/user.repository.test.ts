import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { UserRepository, CreateUserData } from '../user.repository.js';

describe('UserRepository', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repository: UserRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test');
    repository = new UserRepository(db);
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
  });

  // Test data factory
  function createUserData(overrides: Partial<CreateUserData> = {}): CreateUserData {
    const uniqueId = new ObjectId().toString().slice(0, 8);
    return {
      email: `test-${uniqueId}@example.com`,
      passwordHash: '$2b$10$hashedpassword',
      name: 'Test User',
      ...overrides,
    };
  }

  describe('create', () => {
    it('should create a user with required fields', async () => {
      const data = createUserData({
        email: 'john@example.com',
        name: 'John Doe',
      });

      const user = await repository.create(data);

      expect(user._id).toBeDefined();
      expect(user.email).toBe('john@example.com');
      expect(user.name).toBe('John Doe');
      expect(user.passwordHash).toBe(data.passwordHash);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should initialize default preferences', async () => {
      const user = await repository.create(createUserData());

      expect(user.preferences).toEqual({
        defaultSummarizedFolder: null,
        defaultMemorizedFolder: null,
        theme: 'system',
      });
    });

    it('should initialize usage tracking', async () => {
      const user = await repository.create(createUserData());

      expect(user.usage.videosThisMonth).toBe(0);
      expect(user.usage.videosResetAt).toBeInstanceOf(Date);
    });

    it('should not have lastLoginAt initially', async () => {
      const user = await repository.create(createUserData());

      expect(user.lastLoginAt).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const created = await repository.create(createUserData());

      const found = await repository.findById(created._id.toString());

      expect(found).not.toBeNull();
      expect(found?._id.toString()).toBe(created._id.toString());
    });

    it('should return null when user not found', async () => {
      const nonExistentId = new ObjectId().toString();

      const found = await repository.findById(nonExistentId);

      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const data = createUserData({ email: 'findme@example.com' });
      await repository.create(data);

      const found = await repository.findByEmail('findme@example.com');

      expect(found).not.toBeNull();
      expect(found?.email).toBe('findme@example.com');
    });

    it('should return null when email not found', async () => {
      const found = await repository.findByEmail('nonexistent@example.com');

      expect(found).toBeNull();
    });

    it('should be case sensitive for email lookup', async () => {
      await repository.create(createUserData({ email: 'Test@Example.com' }));

      const found = await repository.findByEmail('test@example.com');

      expect(found).toBeNull();
    });
  });

  describe('updateLastLogin', () => {
    it('should set lastLoginAt timestamp', async () => {
      const created = await repository.create(createUserData());
      expect(created.lastLoginAt).toBeUndefined();

      await repository.updateLastLogin(created._id.toString());

      const updated = await repository.findById(created._id.toString());
      expect(updated?.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should update lastLoginAt to current time', async () => {
      const created = await repository.create(createUserData());
      const beforeUpdate = new Date();

      await repository.updateLastLogin(created._id.toString());

      const updated = await repository.findById(created._id.toString());
      expect(updated?.lastLoginAt?.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('update', () => {
    it('should update user name', async () => {
      const created = await repository.create(createUserData({ name: 'Old Name' }));

      await repository.update(created._id.toString(), { name: 'New Name' });

      const updated = await repository.findById(created._id.toString());
      expect(updated?.name).toBe('New Name');
    });

    it('should update user email', async () => {
      const created = await repository.create(createUserData());

      await repository.update(created._id.toString(), { email: 'newemail@example.com' });

      const updated = await repository.findById(created._id.toString());
      expect(updated?.email).toBe('newemail@example.com');
    });

    it('should update user preferences', async () => {
      const created = await repository.create(createUserData());
      const folderId = new ObjectId();

      await repository.update(created._id.toString(), {
        preferences: {
          defaultSummarizedFolder: folderId,
          defaultMemorizedFolder: null,
          theme: 'dark',
        },
      });

      const updated = await repository.findById(created._id.toString());
      expect(updated?.preferences.defaultSummarizedFolder?.toString()).toBe(folderId.toString());
      expect(updated?.preferences.theme).toBe('dark');
    });

    it('should update usage tracking', async () => {
      const created = await repository.create(createUserData());

      await repository.update(created._id.toString(), {
        usage: {
          videosThisMonth: 10,
          videosResetAt: new Date('2024-01-01'),
        },
      });

      const updated = await repository.findById(created._id.toString());
      expect(updated?.usage.videosThisMonth).toBe(10);
    });

    it('should update updatedAt timestamp', async () => {
      const created = await repository.create(createUserData());
      const originalUpdatedAt = created.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      await repository.update(created._id.toString(), { name: 'Updated' });

      const updated = await repository.findById(created._id.toString());
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should update multiple fields at once', async () => {
      const created = await repository.create(createUserData());

      await repository.update(created._id.toString(), {
        name: 'New Name',
        email: 'new@example.com',
      });

      const updated = await repository.findById(created._id.toString());
      expect(updated?.name).toBe('New Name');
      expect(updated?.email).toBe('new@example.com');
    });

    it('should preserve other fields when updating', async () => {
      const created = await repository.create(createUserData({
        name: 'Original Name',
        email: 'original@example.com',
      }));

      await repository.update(created._id.toString(), { name: 'New Name' });

      const updated = await repository.findById(created._id.toString());
      expect(updated?.name).toBe('New Name');
      expect(updated?.email).toBe('original@example.com'); // Should remain unchanged
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple users with unique emails', async () => {
      const user1 = await repository.create(createUserData({ email: 'user1@example.com' }));
      const user2 = await repository.create(createUserData({ email: 'user2@example.com' }));

      expect(user1._id.toString()).not.toBe(user2._id.toString());
      expect(user1.email).not.toBe(user2.email);
    });
  });
});
