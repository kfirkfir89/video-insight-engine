import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { ObjectId } from 'mongodb';
import { FolderService } from '../folder.service.js';
import type { FolderRepository, FolderDocument } from '../../repositories/folder.repository.js';
import { FolderNotFoundError, ParentFolderNotFoundError } from '../../utils/errors.js';

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
function createFolderDocument(overrides: Partial<FolderDocument> = {}): FolderDocument {
  const id = overrides._id ?? new ObjectId();
  return {
    _id: id,
    userId: new ObjectId(),
    name: 'Test Folder',
    type: 'summarized',
    parentId: null,
    path: '/Test Folder',
    level: 1,
    color: null,
    icon: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('FolderService', () => {
  let folderService: FolderService;
  let mockFolderRepository: {
    findById: ReturnType<typeof vi.fn>;
    findByPath: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    getMaxSiblingOrder: ReturnType<typeof vi.fn>;
    findDescendantsByPath: ReturnType<typeof vi.fn>;
    bulkUpdatePaths: ReturnType<typeof vi.fn>;
    getAllDescendantIds: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteContentInFolders: ReturnType<typeof vi.fn>;
    moveContentToRoot: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockFolderRepository = {
      findById: vi.fn(),
      findByPath: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      getMaxSiblingOrder: vi.fn(),
      findDescendantsByPath: vi.fn(),
      bulkUpdatePaths: vi.fn(),
      getAllDescendantIds: vi.fn(),
      delete: vi.fn(),
      deleteContentInFolders: vi.fn(),
      moveContentToRoot: vi.fn(),
    };

    folderService = new FolderService(
      mockFolderRepository as unknown as FolderRepository,
      mockLogger
    );
  });

  describe('list', () => {
    it('should return all folders for a user', async () => {
      const userId = new ObjectId().toHexString();
      const folders = [
        createFolderDocument({ name: 'Folder 1' }),
        createFolderDocument({ name: 'Folder 2' }),
      ];
      mockFolderRepository.list.mockResolvedValue(folders);

      const result = await folderService.list(userId);

      expect(mockFolderRepository.list).toHaveBeenCalledWith(userId, undefined);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Folder 1');
      expect(result[1].name).toBe('Folder 2');
    });

    it('should filter folders by type', async () => {
      const userId = new ObjectId().toHexString();
      const folders = [createFolderDocument({ type: 'memorized' })];
      mockFolderRepository.list.mockResolvedValue(folders);

      const result = await folderService.list(userId, 'memorized');

      expect(mockFolderRepository.list).toHaveBeenCalledWith(userId, 'memorized');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('memorized');
    });

    it('should return empty array when no folders exist', async () => {
      const userId = new ObjectId().toHexString();
      mockFolderRepository.list.mockResolvedValue([]);

      const result = await folderService.list(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should return folder when found', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId().toHexString();
      const folder = createFolderDocument({ _id: new ObjectId(folderId) });
      mockFolderRepository.findById.mockResolvedValue(folder);

      const result = await folderService.getById(userId, folderId);

      expect(mockFolderRepository.findById).toHaveBeenCalledWith(userId, folderId);
      expect(result.id).toBe(folderId);
    });

    it('should throw FolderNotFoundError when folder does not exist', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId().toHexString();
      mockFolderRepository.findById.mockResolvedValue(null);

      await expect(folderService.getById(userId, folderId)).rejects.toThrow(FolderNotFoundError);
    });
  });

  describe('create', () => {
    it('should create a root folder', async () => {
      const userId = new ObjectId().toHexString();
      const folder = createFolderDocument({ name: 'New Folder', path: '/New Folder', level: 1 });
      mockFolderRepository.getMaxSiblingOrder.mockResolvedValue(0);
      mockFolderRepository.create.mockResolvedValue(folder);

      const result = await folderService.create({
        userId,
        name: 'New Folder',
        type: 'summarized',
      });

      expect(mockFolderRepository.getMaxSiblingOrder).toHaveBeenCalledWith(userId, 'summarized', null);
      expect(mockFolderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Folder' }),
        '/New Folder',
        1,
        0
      );
      expect(result.name).toBe('New Folder');
      expect(result.level).toBe(1);
    });

    it('should create a nested folder with correct path and level', async () => {
      const userId = new ObjectId().toHexString();
      const parentId = new ObjectId();
      const parentFolder = createFolderDocument({
        _id: parentId,
        name: 'Parent',
        path: '/Parent',
        level: 1,
      });
      const childFolder = createFolderDocument({
        name: 'Child',
        parentId,
        path: '/Parent/Child',
        level: 2,
      });

      mockFolderRepository.findById.mockResolvedValue(parentFolder);
      mockFolderRepository.getMaxSiblingOrder.mockResolvedValue(0);
      mockFolderRepository.create.mockResolvedValue(childFolder);

      const result = await folderService.create({
        userId,
        name: 'Child',
        type: 'summarized',
        parentId: parentId.toHexString(),
      });

      expect(mockFolderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Child' }),
        '/Parent/Child',
        2,
        0
      );
      expect(result.level).toBe(2);
      expect(result.path).toBe('/Parent/Child');
    });

    it('should throw ParentFolderNotFoundError when parent does not exist', async () => {
      const userId = new ObjectId().toHexString();
      const parentId = new ObjectId().toHexString();
      mockFolderRepository.findById.mockResolvedValue(null);

      await expect(
        folderService.create({
          userId,
          name: 'Child',
          type: 'summarized',
          parentId,
        })
      ).rejects.toThrow(ParentFolderNotFoundError);
    });

    it('should assign correct order when siblings exist', async () => {
      const userId = new ObjectId().toHexString();
      const folder = createFolderDocument({ order: 3 });
      mockFolderRepository.getMaxSiblingOrder.mockResolvedValue(3);
      mockFolderRepository.create.mockResolvedValue(folder);

      await folderService.create({
        userId,
        name: 'New Folder',
        type: 'summarized',
      });

      expect(mockFolderRepository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        3
      );
    });
  });

  describe('update', () => {
    it('should update folder name without path changes when name stays the same', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const folder = createFolderDocument({ _id: folderId, name: 'Original', color: '#fff' });

      mockFolderRepository.findById
        .mockResolvedValueOnce(folder)
        .mockResolvedValueOnce({ ...folder, color: '#000' });
      mockFolderRepository.update.mockResolvedValue(undefined);

      const result = await folderService.update(userId, folderId.toHexString(), { color: '#000' });

      expect(mockFolderRepository.update).toHaveBeenCalledWith(
        folderId.toHexString(),
        expect.objectContaining({ color: '#000' })
      );
      expect(result.color).toBe('#000');
    });

    it('should update path when name changes', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const folder = createFolderDocument({
        _id: folderId,
        name: 'Original',
        path: '/Original',
      });
      const updatedFolder = createFolderDocument({
        _id: folderId,
        name: 'Renamed',
        path: '/Renamed',
      });

      mockFolderRepository.findById
        .mockResolvedValueOnce(folder)
        .mockResolvedValueOnce(updatedFolder);
      mockFolderRepository.update.mockResolvedValue(undefined);
      mockFolderRepository.findDescendantsByPath.mockResolvedValue([]);

      const result = await folderService.update(userId, folderId.toHexString(), { name: 'Renamed' });

      expect(mockFolderRepository.update).toHaveBeenCalledWith(
        folderId.toHexString(),
        expect.objectContaining({ name: 'Renamed', path: '/Renamed' })
      );
      expect(result.name).toBe('Renamed');
    });

    it('should update descendant paths when folder is renamed', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const descendantId = new ObjectId();

      const folder = createFolderDocument({
        _id: folderId,
        name: 'Parent',
        path: '/Parent',
        level: 1,
      });
      const descendant = createFolderDocument({
        _id: descendantId,
        name: 'Child',
        path: '/Parent/Child',
        level: 2,
      });
      const updatedFolder = createFolderDocument({
        _id: folderId,
        name: 'NewParent',
        path: '/NewParent',
      });

      mockFolderRepository.findById
        .mockResolvedValueOnce(folder)
        .mockResolvedValueOnce(updatedFolder);
      mockFolderRepository.update.mockResolvedValue(undefined);
      mockFolderRepository.findDescendantsByPath.mockResolvedValue([descendant]);
      mockFolderRepository.bulkUpdatePaths.mockResolvedValue(undefined);

      await folderService.update(userId, folderId.toHexString(), { name: 'NewParent' });

      expect(mockFolderRepository.bulkUpdatePaths).toHaveBeenCalledWith([
        {
          id: descendantId.toHexString(),
          path: '/NewParent/Child',
          level: 2,
        },
      ]);
    });

    it('should throw FolderNotFoundError when folder does not exist', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId().toHexString();
      mockFolderRepository.findById.mockResolvedValue(null);

      await expect(
        folderService.update(userId, folderId, { name: 'New Name' })
      ).rejects.toThrow(FolderNotFoundError);
    });

    it('should prevent moving folder into itself', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const folder = createFolderDocument({ _id: folderId });

      mockFolderRepository.findById.mockResolvedValue(folder);
      mockFolderRepository.getAllDescendantIds.mockResolvedValue([]);

      await expect(
        folderService.update(userId, folderId.toHexString(), { parentId: folderId.toHexString() })
      ).rejects.toThrow('Cannot move folder into itself or its descendants');
    });

    it('should prevent moving folder into its descendants', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const descendantId = new ObjectId();
      const folder = createFolderDocument({ _id: folderId });

      mockFolderRepository.findById.mockResolvedValue(folder);
      mockFolderRepository.getAllDescendantIds.mockResolvedValue([descendantId]);

      await expect(
        folderService.update(userId, folderId.toHexString(), { parentId: descendantId.toHexString() })
      ).rejects.toThrow('Cannot move folder into itself or its descendants');
    });

    it('should update path and level when moving to a new parent', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const newParentId = new ObjectId();

      const folder = createFolderDocument({
        _id: folderId,
        name: 'Moving',
        path: '/Moving',
        level: 1,
      });
      const newParent = createFolderDocument({
        _id: newParentId,
        name: 'NewParent',
        path: '/NewParent',
        level: 1,
      });
      const updatedFolder = createFolderDocument({
        _id: folderId,
        name: 'Moving',
        path: '/NewParent/Moving',
        level: 2,
        parentId: newParentId,
      });

      mockFolderRepository.findById
        .mockResolvedValueOnce(folder)
        .mockResolvedValueOnce(newParent)
        .mockResolvedValueOnce(updatedFolder);
      mockFolderRepository.getAllDescendantIds.mockResolvedValue([]);
      mockFolderRepository.update.mockResolvedValue(undefined);
      mockFolderRepository.findDescendantsByPath.mockResolvedValue([]);

      const result = await folderService.update(userId, folderId.toHexString(), {
        parentId: newParentId.toHexString(),
      });

      expect(mockFolderRepository.update).toHaveBeenCalledWith(
        folderId.toHexString(),
        expect.objectContaining({
          parentId: newParentId.toHexString(),
          path: '/NewParent/Moving',
          level: 2,
        })
      );
      expect(result.level).toBe(2);
    });

    it('should move folder to root when parentId is null', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const oldParentId = new ObjectId();

      const folder = createFolderDocument({
        _id: folderId,
        name: 'Nested',
        path: '/Parent/Nested',
        level: 2,
        parentId: oldParentId,
      });
      const updatedFolder = createFolderDocument({
        _id: folderId,
        name: 'Nested',
        path: '/Nested',
        level: 1,
        parentId: null,
      });

      mockFolderRepository.findById
        .mockResolvedValueOnce(folder)
        .mockResolvedValueOnce(updatedFolder);
      mockFolderRepository.getAllDescendantIds.mockResolvedValue([]);
      mockFolderRepository.update.mockResolvedValue(undefined);
      mockFolderRepository.findDescendantsByPath.mockResolvedValue([]);

      const result = await folderService.update(userId, folderId.toHexString(), { parentId: null });

      expect(mockFolderRepository.update).toHaveBeenCalledWith(
        folderId.toHexString(),
        expect.objectContaining({
          parentId: null,
          path: '/Nested',
          level: 1,
        })
      );
      expect(result.level).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete folder and move content to root by default', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const folder = createFolderDocument({ _id: folderId });

      mockFolderRepository.findById.mockResolvedValue(folder);
      mockFolderRepository.getAllDescendantIds.mockResolvedValue([]);
      mockFolderRepository.moveContentToRoot.mockResolvedValue(undefined);
      mockFolderRepository.delete.mockResolvedValue(undefined);

      await folderService.delete(userId, folderId.toHexString());

      expect(mockFolderRepository.moveContentToRoot).toHaveBeenCalledWith([folderId], userId);
      expect(mockFolderRepository.delete).toHaveBeenCalledWith([folderId], userId);
    });

    it('should delete folder and its content when deleteContent is true', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const folder = createFolderDocument({ _id: folderId });

      mockFolderRepository.findById.mockResolvedValue(folder);
      mockFolderRepository.getAllDescendantIds.mockResolvedValue([]);
      mockFolderRepository.deleteContentInFolders.mockResolvedValue(undefined);
      mockFolderRepository.delete.mockResolvedValue(undefined);

      await folderService.delete(userId, folderId.toHexString(), true);

      expect(mockFolderRepository.deleteContentInFolders).toHaveBeenCalledWith([folderId], userId);
      expect(mockFolderRepository.delete).toHaveBeenCalledWith([folderId], userId);
    });

    it('should delete folder and all descendants', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId();
      const descendantId1 = new ObjectId();
      const descendantId2 = new ObjectId();
      const folder = createFolderDocument({ _id: folderId });

      mockFolderRepository.findById.mockResolvedValue(folder);
      mockFolderRepository.getAllDescendantIds.mockResolvedValue([descendantId1, descendantId2]);
      mockFolderRepository.moveContentToRoot.mockResolvedValue(undefined);
      mockFolderRepository.delete.mockResolvedValue(undefined);

      await folderService.delete(userId, folderId.toHexString());

      expect(mockFolderRepository.moveContentToRoot).toHaveBeenCalledWith(
        [folderId, descendantId1, descendantId2],
        userId
      );
      expect(mockFolderRepository.delete).toHaveBeenCalledWith(
        [folderId, descendantId1, descendantId2],
        userId
      );
    });

    it('should throw FolderNotFoundError when folder does not exist', async () => {
      const userId = new ObjectId().toHexString();
      const folderId = new ObjectId().toHexString();
      mockFolderRepository.findById.mockResolvedValue(null);

      await expect(folderService.delete(userId, folderId)).rejects.toThrow(FolderNotFoundError);
    });
  });
});
