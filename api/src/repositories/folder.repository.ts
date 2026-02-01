import { Db, ObjectId, Collection, AnyBulkWriteOperation } from 'mongodb';

export interface FolderDocument {
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

export interface CreateFolderData {
  userId: string;
  name: string;
  type: 'summarized' | 'memorized';
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateFolderData {
  name?: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
  path?: string;
  level?: number;
}

export class FolderRepository {
  private readonly collection: Collection<FolderDocument>;
  private readonly userVideosCollection: Collection;
  private readonly memorizedItemsCollection: Collection;
  private readonly userChatsCollection: Collection;

  constructor(db: Db) {
    this.collection = db.collection('folders');
    this.userVideosCollection = db.collection('userVideos');
    this.memorizedItemsCollection = db.collection('memorizedItems');
    this.userChatsCollection = db.collection('userChats');
  }

  async findById(userId: string, folderId: string): Promise<FolderDocument | null> {
    return this.collection.findOne({
      _id: new ObjectId(folderId),
      userId: new ObjectId(userId),
    });
  }

  async findByPath(userId: string, path: string): Promise<FolderDocument | null> {
    return this.collection.findOne({
      userId: new ObjectId(userId),
      path,
    });
  }

  async list(userId: string, type?: 'summarized' | 'memorized'): Promise<FolderDocument[]> {
    const query: Record<string, unknown> = { userId: new ObjectId(userId) };
    if (type) {
      query.type = type;
    }

    return this.collection
      .find(query)
      .sort({ path: 1, order: 1 })
      .toArray();
  }

  async create(data: CreateFolderData, path: string, level: number, order: number): Promise<FolderDocument> {
    const now = new Date();
    const doc: Omit<FolderDocument, '_id'> = {
      userId: new ObjectId(data.userId),
      name: data.name,
      type: data.type,
      parentId: data.parentId ? new ObjectId(data.parentId) : null,
      path,
      level,
      color: data.color ?? null,
      icon: data.icon ?? null,
      order,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(doc as FolderDocument);
    return { ...doc, _id: result.insertedId } as FolderDocument;
  }

  async update(folderId: string, updates: UpdateFolderData): Promise<void> {
    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.color !== undefined) setFields.color = updates.color;
    if (updates.icon !== undefined) setFields.icon = updates.icon;
    if (updates.parentId !== undefined) {
      setFields.parentId = updates.parentId ? new ObjectId(updates.parentId) : null;
    }
    if (updates.path !== undefined) setFields.path = updates.path;
    if (updates.level !== undefined) setFields.level = updates.level;

    await this.collection.updateOne(
      { _id: new ObjectId(folderId) },
      { $set: setFields }
    );
  }

  async getMaxSiblingOrder(userId: string, type: 'summarized' | 'memorized', parentId: string | null): Promise<number> {
    const siblings = await this.collection
      .find({
        userId: new ObjectId(userId),
        type,
        parentId: parentId ? new ObjectId(parentId) : null,
      })
      .sort({ order: -1 })
      .limit(1)
      .toArray();

    return siblings.length > 0 ? siblings[0].order + 1 : 0;
  }

  async findDescendantsByPath(userId: string, pathPrefix: string): Promise<FolderDocument[]> {
    const escapedPath = pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.collection.find({
      userId: new ObjectId(userId),
      path: { $regex: `^${escapedPath}/` },
    }).toArray();
  }

  async bulkUpdatePaths(updates: Array<{ id: string; path: string; level: number }>): Promise<void> {
    if (updates.length === 0) return;

    const bulkOps: AnyBulkWriteOperation<FolderDocument>[] = updates.map((update) => ({
      updateOne: {
        filter: { _id: new ObjectId(update.id) },
        update: {
          $set: {
            path: update.path,
            level: update.level,
            updatedAt: new Date(),
          },
        },
      },
    }));

    await this.collection.bulkWrite(bulkOps);
  }

  async getAllDescendantIds(userId: string, parentFolderId: string): Promise<ObjectId[]> {
    const result = await this.collection.aggregate<{ descendants: { _id: ObjectId }[] }>([
      { $match: { _id: new ObjectId(parentFolderId), userId: new ObjectId(userId) } },
      {
        $graphLookup: {
          from: 'folders',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parentId',
          as: 'descendants',
          restrictSearchWithMatch: { userId: new ObjectId(userId) },
        },
      },
      { $project: { descendants: { _id: 1 } } },
    ]).toArray();

    if (result.length === 0 || !result[0].descendants) {
      return [];
    }

    return result[0].descendants.map(d => d._id);
  }

  async delete(folderIds: ObjectId[], userId: string): Promise<void> {
    await this.collection.deleteMany({
      _id: { $in: folderIds },
      userId: new ObjectId(userId),
    });
  }

  async deleteContentInFolders(folderIds: ObjectId[], userId: string): Promise<void> {
    const userObjectId = new ObjectId(userId);

    // Delete userVideos
    await this.userVideosCollection.deleteMany({
      userId: userObjectId,
      folderId: { $in: folderIds },
    });

    // Get memorizedItems to delete associated chats
    const memorizedItems = await this.memorizedItemsCollection.find({
      userId: userObjectId,
      folderId: { $in: folderIds },
    }).toArray();

    const memorizedItemIds = memorizedItems.map(item => item._id);

    if (memorizedItemIds.length > 0) {
      await this.userChatsCollection.deleteMany({
        userId: userObjectId,
        memorizedItemId: { $in: memorizedItemIds },
      });

      await this.memorizedItemsCollection.deleteMany({
        userId: userObjectId,
        folderId: { $in: folderIds },
      });
    }
  }

  async moveContentToRoot(folderIds: ObjectId[], userId: string): Promise<void> {
    const userObjectId = new ObjectId(userId);
    const now = new Date();

    await this.userVideosCollection.updateMany(
      { userId: userObjectId, folderId: { $in: folderIds } },
      { $set: { folderId: null, updatedAt: now } }
    );

    await this.memorizedItemsCollection.updateMany(
      { userId: userObjectId, folderId: { $in: folderIds } },
      { $set: { folderId: null, updatedAt: now } }
    );
  }
}
