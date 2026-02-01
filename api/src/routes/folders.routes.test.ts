import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, getAuthHeader, type MockContainer } from '../test/helpers.js';

describe('folders routes', () => {
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

  describe('GET /api/folders', () => {
    it('should return all folders', async () => {
      const mockFolders = [
        { id: 'f1', name: 'Work', type: 'summarized' },
        { id: 'f2', name: 'Personal', type: 'memorized' },
      ];
      mockContainer.folderService.list.mockResolvedValue(mockFolders);

      const response = await app.inject({
        method: 'GET',
        url: '/api/folders',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.folderService.list).toHaveBeenCalledWith('test-user-id', undefined);
      expect(response.json()).toEqual({ folders: mockFolders });
    });

    it('should filter by type when provided', async () => {
      mockContainer.folderService.list.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/folders?type=summarized',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.folderService.list).toHaveBeenCalledWith('test-user-id', 'summarized');
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/folders',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/folders/:id', () => {
    it('should return a single folder', async () => {
      const mockFolder = { id: 'f1', name: 'Work', type: 'summarized' };
      mockContainer.folderService.getById.mockResolvedValue(mockFolder);

      const response = await app.inject({
        method: 'GET',
        url: '/api/folders/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.folderService.getById).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011'
      );
      expect(response.json()).toEqual(mockFolder);
    });

    it('should return 404 when folder not found', async () => {
      const { FolderNotFoundError } = await import('../utils/errors.js');
      mockContainer.folderService.getById.mockRejectedValue(new FolderNotFoundError());

      const response = await app.inject({
        method: 'GET',
        url: '/api/folders/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/folders', () => {
    it('should create a folder', async () => {
      const mockFolder = { id: 'f1', name: 'New Folder', type: 'summarized' };
      mockContainer.folderService.create.mockResolvedValue(mockFolder);

      const response = await app.inject({
        method: 'POST',
        url: '/api/folders',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          name: 'New Folder',
          type: 'summarized',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.folderService.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        name: 'New Folder',
        type: 'summarized',
      });
      expect(response.json()).toEqual(mockFolder);
    });

    it('should accept optional parentId, color, and icon', async () => {
      const mockFolder = { id: 'f1', name: 'Sub Folder', type: 'memorized' };
      mockContainer.folderService.create.mockResolvedValue(mockFolder);

      const response = await app.inject({
        method: 'POST',
        url: '/api/folders',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Sub Folder',
          type: 'memorized',
          parentId: '507f1f77bcf86cd799439011',
          color: '#ff0000',
          icon: 'folder',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.folderService.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        name: 'Sub Folder',
        type: 'memorized',
        parentId: '507f1f77bcf86cd799439011',
        color: '#ff0000',
        icon: 'folder',
      });
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/folders',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Folder Without Type',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/folders',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Invalid Folder',
          type: 'invalid',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/folders/:id', () => {
    it('should update a folder', async () => {
      const mockFolder = { id: 'f1', name: 'Updated Name', type: 'summarized' };
      mockContainer.folderService.update.mockResolvedValue(mockFolder);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/folders/507f1f77bcf86cd799439011',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.folderService.update).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        { name: 'Updated Name' }
      );
      expect(response.json()).toEqual(mockFolder);
    });

    it('should allow setting parentId to null', async () => {
      mockContainer.folderService.update.mockResolvedValue({ id: 'f1' });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/folders/507f1f77bcf86cd799439011',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          parentId: null,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.folderService.update).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        { parentId: null }
      );
    });
  });

  describe('DELETE /api/folders/:id', () => {
    it('should delete a folder and move content to root', async () => {
      mockContainer.folderService.delete.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/folders/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(204);
      expect(mockContainer.folderService.delete).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        false
      );
    });

    it('should delete folder and content when deleteContent=true', async () => {
      mockContainer.folderService.delete.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/folders/507f1f77bcf86cd799439011?deleteContent=true',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(204);
      expect(mockContainer.folderService.delete).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        true
      );
    });

    it('should return 404 when folder not found', async () => {
      const { FolderNotFoundError } = await import('../utils/errors.js');
      mockContainer.folderService.delete.mockRejectedValue(new FolderNotFoundError());

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/folders/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
