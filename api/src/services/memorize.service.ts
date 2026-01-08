import { Db, ObjectId } from 'mongodb';

export interface MemorizedItem {
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

export interface CreateMemorizedItemInput {
  userId: string;
  title: string;
  sourceType: 'video_section' | 'video_concept' | 'system_expansion';
  videoSummaryId: string;
  sectionIds?: string[];
  conceptId?: string;
  expansionId?: string;
  startSeconds?: number;
  endSeconds?: number;
  folderId?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface UpdateMemorizedItemInput {
  title?: string;
  notes?: string | null;
  tags?: string[];
  folderId?: string | null;
}

interface VideoSummaryCache {
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

interface SystemExpansion {
  _id: ObjectId;
  content: string;
}

interface UserChat {
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

const COLLECTION = 'memorizedItems';
const VIDEO_SUMMARY_CACHE = 'videoSummaryCache';
const SYSTEM_EXPANSION_CACHE = 'systemExpansionCache';
const USER_CHATS = 'userChats';

function toItemListResponse(item: MemorizedItem) {
  return {
    id: item._id.toHexString(),
    title: item.title,
    sourceType: item.sourceType,
    source: {
      videoTitle: item.source.videoTitle,
      youtubeUrl: item.source.youtubeUrl,
    },
    folderId: item.folderId?.toHexString() ?? null,
    tags: item.tags,
    createdAt: item.createdAt.toISOString(),
  };
}

function toItemDetailResponse(item: MemorizedItem) {
  return {
    id: item._id.toHexString(),
    title: item.title,
    sourceType: item.sourceType,
    source: {
      videoSummaryId: item.source.videoSummaryId.toHexString(),
      youtubeId: item.source.youtubeId,
      videoTitle: item.source.videoTitle,
      videoThumbnail: item.source.videoThumbnail,
      youtubeUrl: item.source.youtubeUrl,
      startSeconds: item.source.startSeconds,
      endSeconds: item.source.endSeconds,
      content: item.source.content,
    },
    folderId: item.folderId?.toHexString() ?? null,
    notes: item.notes,
    tags: item.tags,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listMemorizedItems(
  db: Db,
  userId: string,
  folderId?: string
) {
  const query: { userId: ObjectId; folderId?: ObjectId | null } = {
    userId: new ObjectId(userId),
  };

  if (folderId !== undefined) {
    query.folderId = folderId ? new ObjectId(folderId) : null;
  }

  const items = await db
    .collection<MemorizedItem>(COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  return items.map(toItemListResponse);
}

export async function getMemorizedItemById(
  db: Db,
  userId: string,
  itemId: string
) {
  const item = await db.collection<MemorizedItem>(COLLECTION).findOne({
    _id: new ObjectId(itemId),
    userId: new ObjectId(userId),
  });

  return item ? toItemDetailResponse(item) : null;
}

export async function createMemorizedItem(
  db: Db,
  input: CreateMemorizedItemInput
) {
  const userObjectId = new ObjectId(input.userId);
  const videoSummaryObjectId = new ObjectId(input.videoSummaryId);

  // Fetch the video summary cache to get content
  const videoSummary = await db
    .collection<VideoSummaryCache>(VIDEO_SUMMARY_CACHE)
    .findOne({ _id: videoSummaryObjectId });

  if (!videoSummary || !videoSummary.summary) {
    throw new Error('Video summary not found or not processed');
  }

  // Build the source content based on sourceType
  let content: MemorizedItem['source']['content'] = {};
  let startSeconds: number | undefined;
  let endSeconds: number | undefined;

  if (input.sourceType === 'video_section' && input.sectionIds) {
    const sections = videoSummary.summary.sections.filter((s) =>
      input.sectionIds!.includes(s.id)
    );

    if (sections.length === 0) {
      throw new Error('No matching sections found');
    }

    content.sections = sections.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      title: s.title,
      summary: s.summary,
      bullets: s.bullets,
    }));

    startSeconds = input.startSeconds ?? sections[0].startSeconds;
    endSeconds = input.endSeconds ?? sections[sections.length - 1].endSeconds;
  } else if (input.sourceType === 'video_concept' && input.conceptId) {
    const concept = videoSummary.summary.concepts.find(
      (c) => c.id === input.conceptId
    );

    if (!concept) {
      throw new Error('Concept not found');
    }

    content.concept = {
      name: concept.name,
      definition: concept.definition,
    };
  } else if (input.sourceType === 'system_expansion' && input.expansionId) {
    const expansion = await db
      .collection<SystemExpansion>(SYSTEM_EXPANSION_CACHE)
      .findOne({ _id: new ObjectId(input.expansionId) });

    if (!expansion) {
      throw new Error('Expansion not found');
    }

    content.expansion = expansion.content;
  }

  const youtubeUrl = startSeconds
    ? `${videoSummary.url}&t=${startSeconds}`
    : videoSummary.url;

  const now = new Date();
  const item: Omit<MemorizedItem, '_id'> = {
    userId: userObjectId,
    title: input.title,
    folderId: input.folderId ? new ObjectId(input.folderId) : null,
    sourceType: input.sourceType,
    source: {
      videoSummaryId: videoSummaryObjectId,
      youtubeId: videoSummary.youtubeId,
      videoTitle: videoSummary.title,
      videoThumbnail: videoSummary.thumbnailUrl ?? '',
      youtubeUrl,
      startSeconds,
      endSeconds,
      sectionIds: input.sectionIds,
      expansionId: input.expansionId ? new ObjectId(input.expansionId) : undefined,
      content,
    },
    notes: input.notes ?? null,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  const result = await db
    .collection<MemorizedItem>(COLLECTION)
    .insertOne(item as MemorizedItem);

  return toItemDetailResponse({ ...item, _id: result.insertedId } as MemorizedItem);
}

export async function updateMemorizedItem(
  db: Db,
  userId: string,
  itemId: string,
  input: UpdateMemorizedItemInput
) {
  const userObjectId = new ObjectId(userId);
  const itemObjectId = new ObjectId(itemId);

  const existing = await db.collection<MemorizedItem>(COLLECTION).findOne({
    _id: itemObjectId,
    userId: userObjectId,
  });

  if (!existing) {
    return null;
  }

  const updates: Partial<MemorizedItem> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) {
    updates.title = input.title;
  }
  if (input.notes !== undefined) {
    updates.notes = input.notes;
  }
  if (input.tags !== undefined) {
    updates.tags = input.tags;
  }
  if (input.folderId !== undefined) {
    updates.folderId = input.folderId ? new ObjectId(input.folderId) : null;
  }

  await db.collection<MemorizedItem>(COLLECTION).updateOne(
    { _id: itemObjectId },
    { $set: updates }
  );

  const updated = await db.collection<MemorizedItem>(COLLECTION).findOne({
    _id: itemObjectId,
  });

  return updated ? toItemDetailResponse(updated) : null;
}

export async function deleteMemorizedItem(
  db: Db,
  userId: string,
  itemId: string
) {
  const userObjectId = new ObjectId(userId);
  const itemObjectId = new ObjectId(itemId);

  const result = await db.collection<MemorizedItem>(COLLECTION).deleteOne({
    _id: itemObjectId,
    userId: userObjectId,
  });

  if (result.deletedCount === 0) {
    return false;
  }

  // Delete associated chats
  await db.collection(USER_CHATS).deleteMany({
    userId: userObjectId,
    memorizedItemId: itemObjectId,
  });

  return true;
}

export async function listChatsForItem(
  db: Db,
  userId: string,
  itemId: string
) {
  const chats = await db
    .collection<UserChat>(USER_CHATS)
    .find({
      userId: new ObjectId(userId),
      memorizedItemId: new ObjectId(itemId),
    })
    .sort({ updatedAt: -1 })
    .toArray();

  return chats.map((chat) => ({
    id: chat._id.toHexString(),
    title: chat.title,
    messageCount: chat.messages.length,
    updatedAt: chat.updatedAt.toISOString(),
  }));
}
