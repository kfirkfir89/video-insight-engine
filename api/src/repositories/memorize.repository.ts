import { Db, ObjectId, Collection } from 'mongodb';

export interface MemorizedItemDocument {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  folderId: ObjectId | null;
  sourceType: 'video_section' | 'video_concept' | 'system_expansion';
  source: {
    videoSummaryId: ObjectId;
    youtubeId: string;
    videoTitle: string;
    videoThumbnail: string;
    youtubeUrl: string;
    startSeconds?: number;
    endSeconds?: number;
    sectionIds?: string[];
    expansionId?: ObjectId;
    content: {
      sections?: Array<{
        id: string;
        timestamp: string;
        title: string;
        summary: string;
        bullets: string[];
      }>;
      concept?: {
        name: string;
        definition: string | null;
      };
      expansion?: string;
    };
  };
  notes: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserChatDocument {
  _id: ObjectId;
  userId: ObjectId;
  memorizedItemId: ObjectId;
  title: string | null;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoSummaryCacheForMemorize {
  _id: ObjectId;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  url: string;
  summary: {
    sections: Array<{
      id: string;
      timestamp: string;
      startSeconds: number;
      endSeconds: number;
      title: string;
      summary: string;
      bullets: string[];
    }>;
    concepts: Array<{
      id: string;
      name: string;
      definition: string | null;
    }>;
  } | null;
}

export interface SystemExpansionDocument {
  _id: ObjectId;
  content: string;
}

export interface CreateMemorizedItemData {
  userId: string;
  title: string;
  sourceType: 'video_section' | 'video_concept' | 'system_expansion';
  source: MemorizedItemDocument['source'];
  folderId?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface UpdateMemorizedItemData {
  title?: string;
  notes?: string | null;
  tags?: string[];
  folderId?: string | null;
}

export class MemorizeRepository {
  private readonly collection: Collection<MemorizedItemDocument>;
  private readonly userChatsCollection: Collection<UserChatDocument>;
  private readonly videoSummaryCacheCollection: Collection<VideoSummaryCacheForMemorize>;
  private readonly systemExpansionCacheCollection: Collection<SystemExpansionDocument>;

  constructor(db: Db) {
    this.collection = db.collection('memorizedItems');
    this.userChatsCollection = db.collection('userChats');
    this.videoSummaryCacheCollection = db.collection('videoSummaryCache');
    this.systemExpansionCacheCollection = db.collection('systemExpansionCache');
  }

  async findById(userId: string, itemId: string): Promise<MemorizedItemDocument | null> {
    return this.collection.findOne({
      _id: new ObjectId(itemId),
      userId: new ObjectId(userId),
    });
  }

  async list(
    userId: string,
    folderId?: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<MemorizedItemDocument[]> {
    const { limit = 50, offset = 0 } = options;
    const query: Record<string, unknown> = { userId: new ObjectId(userId) };

    if (folderId !== undefined) {
      query.folderId = folderId ? new ObjectId(folderId) : null;
    }

    return this.collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async create(data: CreateMemorizedItemData): Promise<MemorizedItemDocument> {
    const now = new Date();
    const doc: Omit<MemorizedItemDocument, '_id'> = {
      userId: new ObjectId(data.userId),
      title: data.title,
      folderId: data.folderId ? new ObjectId(data.folderId) : null,
      sourceType: data.sourceType,
      source: data.source,
      notes: data.notes ?? null,
      tags: data.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(doc as MemorizedItemDocument);
    return { ...doc, _id: result.insertedId } as MemorizedItemDocument;
  }

  async update(userId: string, itemId: string, updates: UpdateMemorizedItemData): Promise<MemorizedItemDocument | null> {
    const setFields: Record<string, unknown> = { updatedAt: new Date() };

    if (updates.title !== undefined) setFields.title = updates.title;
    if (updates.notes !== undefined) setFields.notes = updates.notes;
    if (updates.tags !== undefined) setFields.tags = updates.tags;
    if (updates.folderId !== undefined) {
      setFields.folderId = updates.folderId ? new ObjectId(updates.folderId) : null;
    }

    await this.collection.updateOne(
      { _id: new ObjectId(itemId), userId: new ObjectId(userId) },
      { $set: setFields }
    );

    return this.findById(userId, itemId);
  }

  async delete(userId: string, itemId: string): Promise<boolean> {
    const userObjectId = new ObjectId(userId);
    const itemObjectId = new ObjectId(itemId);

    const result = await this.collection.deleteOne({
      _id: itemObjectId,
      userId: userObjectId,
    });

    if (result.deletedCount > 0) {
      // Delete associated chats
      await this.userChatsCollection.deleteMany({
        userId: userObjectId,
        memorizedItemId: itemObjectId,
      });
      return true;
    }

    return false;
  }

  async listChats(userId: string, itemId: string): Promise<UserChatDocument[]> {
    return this.userChatsCollection
      .find({
        userId: new ObjectId(userId),
        memorizedItemId: new ObjectId(itemId),
      })
      .sort({ updatedAt: -1 })
      .toArray();
  }

  async getVideoSummaryCache(videoSummaryId: string): Promise<VideoSummaryCacheForMemorize | null> {
    return this.videoSummaryCacheCollection.findOne({ _id: new ObjectId(videoSummaryId) });
  }

  async getSystemExpansion(expansionId: string): Promise<SystemExpansionDocument | null> {
    return this.systemExpansionCacheCollection.findOne({ _id: new ObjectId(expansionId) });
  }
}
