import { FastifyBaseLogger } from 'fastify';
import { ObjectId } from 'mongodb';
import { FolderRepository, FolderDocument, CreateFolderData, UpdateFolderData } from '../repositories/folder.repository.js';
import { FolderNotFoundError, ParentFolderNotFoundError } from '../utils/errors.js';

export interface FolderResponse {
  id: string;
  name: string;
  type: 'summarized' | 'memorized';
  parentId: string | null;
  path: string;
  level: number;
  color: string | null;
  icon: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}

function toFolderResponse(folder: FolderDocument): FolderResponse {
  return {
    id: folder._id.toHexString(),
    name: folder.name,
    type: folder.type,
    parentId: folder.parentId?.toHexString() ?? null,
    path: folder.path,
    level: folder.level,
    color: folder.color,
    icon: folder.icon,
    order: folder.order,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export class FolderService {
  constructor(
    private readonly folderRepository: FolderRepository,
    private readonly logger: FastifyBaseLogger
  ) {}

  async list(userId: string, type?: 'summarized' | 'memorized'): Promise<FolderResponse[]> {
    const folders = await this.folderRepository.list(userId, type);
    return folders.map(toFolderResponse);
  }

  async getById(userId: string, folderId: string): Promise<FolderResponse> {
    const folder = await this.folderRepository.findById(userId, folderId);
    if (!folder) {
      throw new FolderNotFoundError();
    }
    return toFolderResponse(folder);
  }

  async create(input: CreateFolderData): Promise<FolderResponse> {
    // Calculate path and level
    let path = `/${input.name}`;
    let level = 1;

    if (input.parentId) {
      const parent = await this.folderRepository.findById(input.userId, input.parentId);
      if (!parent) {
        throw new ParentFolderNotFoundError();
      }
      path = `${parent.path}/${input.name}`;
      level = parent.level + 1;
    }

    // Get max order for siblings
    const order = await this.folderRepository.getMaxSiblingOrder(
      input.userId,
      input.type,
      input.parentId ?? null
    );

    const folder = await this.folderRepository.create(input, path, level, order);
    return toFolderResponse(folder);
  }

  async update(userId: string, folderId: string, input: UpdateFolderInput): Promise<FolderResponse> {
    const existing = await this.folderRepository.findById(userId, folderId);
    if (!existing) {
      throw new FolderNotFoundError();
    }

    const updates: UpdateFolderData = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.color !== undefined) updates.color = input.color;
    if (input.icon !== undefined) updates.icon = input.icon;

    // Handle parent change (re-calculate path and level)
    if (input.parentId !== undefined) {
      const newParentId = input.parentId;

      // Prevent moving folder into itself or its descendants
      if (newParentId) {
        const descendants = await this.folderRepository.getAllDescendantIds(userId, folderId);
        if (newParentId === folderId || descendants.some(d => d.toHexString() === newParentId)) {
          throw new Error('Cannot move folder into itself or its descendants');
        }
      }

      const oldPath = existing.path;
      const oldLevel = existing.level;

      if (newParentId) {
        const parent = await this.folderRepository.findById(userId, newParentId);
        if (!parent) {
          throw new ParentFolderNotFoundError();
        }

        updates.parentId = newParentId;
        updates.path = `${parent.path}/${input.name ?? existing.name}`;
        updates.level = parent.level + 1;
      } else {
        updates.parentId = null;
        updates.path = `/${input.name ?? existing.name}`;
        updates.level = 1;
      }

      const newPath = updates.path!;
      const levelDelta = updates.level! - oldLevel;

      // Update this folder
      await this.folderRepository.update(folderId, updates);

      // Batch update all descendants' paths and levels
      if (oldPath !== newPath || levelDelta !== 0) {
        const descendants = await this.folderRepository.findDescendantsByPath(userId, oldPath);
        if (descendants.length > 0) {
          const pathUpdates = descendants.map(d => ({
            id: d._id.toHexString(),
            path: d.path.replace(oldPath, newPath),
            level: d.level + levelDelta,
          }));
          await this.folderRepository.bulkUpdatePaths(pathUpdates);
        }
      }
    } else if (input.name !== undefined && input.name !== existing.name) {
      // Name changed but parent didn't - update path for this folder and descendants
      const oldPath = existing.path;
      const pathParts = existing.path.split('/');
      pathParts[pathParts.length - 1] = input.name;
      updates.path = pathParts.join('/');
      const newPath = updates.path;

      await this.folderRepository.update(folderId, updates);

      // Batch update descendants' paths
      const descendants = await this.folderRepository.findDescendantsByPath(userId, oldPath);
      if (descendants.length > 0) {
        const pathUpdates = descendants.map(d => ({
          id: d._id.toHexString(),
          path: d.path.replace(oldPath, newPath),
          level: d.level,
        }));
        await this.folderRepository.bulkUpdatePaths(pathUpdates);
      }
    } else {
      // No path-affecting changes, just update the folder
      await this.folderRepository.update(folderId, updates);
    }

    const updated = await this.folderRepository.findById(userId, folderId);
    if (!updated) {
      throw new FolderNotFoundError();
    }

    return toFolderResponse(updated);
  }

  async delete(userId: string, folderId: string, deleteContent = false): Promise<void> {
    const folder = await this.folderRepository.findById(userId, folderId);
    if (!folder) {
      throw new FolderNotFoundError();
    }

    // Get ALL descendant folder IDs (recursive)
    const descendantIds = await this.folderRepository.getAllDescendantIds(userId, folderId);
    const allFolderIds = [folder._id, ...descendantIds];

    if (deleteContent) {
      // MODE: Delete all content from user's library
      await this.folderRepository.deleteContentInFolders(allFolderIds, userId);
    } else {
      // MODE: Move content to ROOT (folderId: null)
      await this.folderRepository.moveContentToRoot(allFolderIds, userId);
    }

    // Delete all folders (target + all descendants)
    await this.folderRepository.delete(allFolderIds, userId);
  }
}
