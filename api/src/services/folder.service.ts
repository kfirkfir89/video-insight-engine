import { Db, ObjectId } from 'mongodb';

export interface Folder {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  type: 'summarized' | 'memorized';
  parentId: ObjectId | null;
  path: string;
  level: number;
  color: string | null;
  icon: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFolderInput {
  userId: string;
  name: string;
  type: 'summarized' | 'memorized';
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}

const COLLECTION = 'folders';

function toFolderResponse(folder: Folder) {
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

export async function listFolders(
  db: Db,
  userId: string,
  type?: 'summarized' | 'memorized'
) {
  const query: { userId: ObjectId; type?: 'summarized' | 'memorized' } = {
    userId: new ObjectId(userId),
  };

  if (type) {
    query.type = type;
  }

  const folders = await db
    .collection<Folder>(COLLECTION)
    .find(query)
    .sort({ path: 1, order: 1 })
    .toArray();

  return folders.map(toFolderResponse);
}

export async function getFolderById(db: Db, userId: string, folderId: string) {
  const folder = await db.collection<Folder>(COLLECTION).findOne({
    _id: new ObjectId(folderId),
    userId: new ObjectId(userId),
  });

  return folder ? toFolderResponse(folder) : null;
}

export async function createFolder(db: Db, input: CreateFolderInput) {
  const userObjectId = new ObjectId(input.userId);
  const parentObjectId = input.parentId ? new ObjectId(input.parentId) : null;

  // Calculate path and level
  let path = `/${input.name}`;
  let level = 1;

  if (parentObjectId) {
    const parent = await db.collection<Folder>(COLLECTION).findOne({
      _id: parentObjectId,
      userId: userObjectId,
    });

    if (!parent) {
      throw new Error('Parent folder not found');
    }

    path = `${parent.path}/${input.name}`;
    level = parent.level + 1;
  }

  // Get max order for siblings
  const siblings = await db
    .collection<Folder>(COLLECTION)
    .find({
      userId: userObjectId,
      type: input.type,
      parentId: parentObjectId,
    })
    .sort({ order: -1 })
    .limit(1)
    .toArray();

  const order = siblings.length > 0 ? siblings[0].order + 1 : 0;

  const now = new Date();
  const folder: Omit<Folder, '_id'> = {
    userId: userObjectId,
    name: input.name,
    type: input.type,
    parentId: parentObjectId,
    path,
    level,
    color: input.color ?? null,
    icon: input.icon ?? null,
    order,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection<Folder>(COLLECTION).insertOne(folder as Folder);

  return toFolderResponse({ ...folder, _id: result.insertedId } as Folder);
}

export async function updateFolder(
  db: Db,
  userId: string,
  folderId: string,
  input: UpdateFolderInput
) {
  const userObjectId = new ObjectId(userId);
  const folderObjectId = new ObjectId(folderId);

  const existing = await db.collection<Folder>(COLLECTION).findOne({
    _id: folderObjectId,
    userId: userObjectId,
  });

  if (!existing) {
    return null;
  }

  const updates: Partial<Folder> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.color !== undefined) {
    updates.color = input.color;
  }
  if (input.icon !== undefined) {
    updates.icon = input.icon;
  }

  // Handle parent change (re-calculate path and level)
  if (input.parentId !== undefined) {
    const newParentId = input.parentId ? new ObjectId(input.parentId) : null;

    if (newParentId) {
      const parent = await db.collection<Folder>(COLLECTION).findOne({
        _id: newParentId,
        userId: userObjectId,
      });

      if (!parent) {
        throw new Error('Parent folder not found');
      }

      updates.parentId = newParentId;
      updates.path = `${parent.path}/${input.name ?? existing.name}`;
      updates.level = parent.level + 1;
    } else {
      updates.parentId = null;
      updates.path = `/${input.name ?? existing.name}`;
      updates.level = 1;
    }
  } else if (input.name !== undefined && input.name !== existing.name) {
    // Name changed but parent didn't - update path
    const pathParts = existing.path.split('/');
    pathParts[pathParts.length - 1] = input.name;
    updates.path = pathParts.join('/');
  }

  await db.collection<Folder>(COLLECTION).updateOne(
    { _id: folderObjectId },
    { $set: updates }
  );

  const updated = await db.collection<Folder>(COLLECTION).findOne({
    _id: folderObjectId,
  });

  return updated ? toFolderResponse(updated) : null;
}

/**
 * Get all descendant folder IDs recursively using BFS
 */
async function getAllDescendantFolderIds(
  db: Db,
  userId: ObjectId,
  parentFolderId: ObjectId
): Promise<ObjectId[]> {
  const allDescendants: ObjectId[] = [];
  const queue: ObjectId[] = [parentFolderId];

  while (queue.length > 0) {
    const currentParentId = queue.shift()!;
    const children = await db.collection<Folder>(COLLECTION).find({
      userId,
      parentId: currentParentId,
    }).toArray();

    for (const child of children) {
      allDescendants.push(child._id);
      queue.push(child._id);
    }
  }
  return allDescendants;
}

/**
 * Delete a folder and optionally all its content
 * @param deleteContent - If true, deletes all userVideos and memorizedItems. If false (default), moves them to root.
 * NOTE: This only removes user associations from userVideos, NOT from videoSummaryCache (which is shared globally)
 */
export async function deleteFolder(
  db: Db,
  userId: string,
  folderId: string,
  deleteContent: boolean = false
): Promise<boolean> {
  const userObjectId = new ObjectId(userId);
  const folderObjectId = new ObjectId(folderId);

  const folder = await db.collection<Folder>(COLLECTION).findOne({
    _id: folderObjectId,
    userId: userObjectId,
  });

  if (!folder) {
    return false;
  }

  // Get ALL descendant folder IDs (recursive)
  const descendantIds = await getAllDescendantFolderIds(db, userObjectId, folderObjectId);
  const allFolderIds = [folderObjectId, ...descendantIds];

  if (deleteContent) {
    // MODE: Delete all content from user's library
    // NOTE: Only deletes from userVideos (user's association), NOT from videoSummaryCache (global cache)

    // 1. Delete userVideos in all folders
    await db.collection('userVideos').deleteMany({
      userId: userObjectId,
      folderId: { $in: allFolderIds },
    });

    // 2. Get memorizedItem IDs to delete associated chats
    const memorizedItems = await db.collection('memorizedItems').find({
      userId: userObjectId,
      folderId: { $in: allFolderIds },
    }).toArray();

    const memorizedItemIds = memorizedItems.map(item => item._id);

    if (memorizedItemIds.length > 0) {
      // Delete associated chats first
      await db.collection('userChats').deleteMany({
        userId: userObjectId,
        memorizedItemId: { $in: memorizedItemIds },
      });

      // Delete memorizedItems
      await db.collection('memorizedItems').deleteMany({
        userId: userObjectId,
        folderId: { $in: allFolderIds },
      });
    }
  } else {
    // MODE: Move content to ROOT (folderId: null)
    const now = new Date();

    // Move userVideos to root
    await db.collection('userVideos').updateMany(
      { userId: userObjectId, folderId: { $in: allFolderIds } },
      { $set: { folderId: null, updatedAt: now } }
    );

    // Move memorizedItems to root
    await db.collection('memorizedItems').updateMany(
      { userId: userObjectId, folderId: { $in: allFolderIds } },
      { $set: { folderId: null, updatedAt: now } }
    );
  }

  // Delete all folders (target + all descendants)
  await db.collection<Folder>(COLLECTION).deleteMany({
    _id: { $in: allFolderIds },
    userId: userObjectId,
  });

  return true;
}
