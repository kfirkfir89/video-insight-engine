import { Db, ObjectId, Collection } from 'mongodb';

export interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  preferences: {
    defaultSummarizedFolder: ObjectId | null;
    defaultMemorizedFolder: ObjectId | null;
    theme: 'light' | 'dark' | 'system';
  };
  usage: {
    videosThisMonth: number;
    videosResetAt: Date;
  };
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

export class UserRepository {
  private readonly collection: Collection<UserDocument>;

  constructor(db: Db) {
    this.collection = db.collection('users');
  }

  async findById(userId: string): Promise<UserDocument | null> {
    return this.collection.findOne({ _id: new ObjectId(userId) });
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.collection.findOne({ email });
  }

  async create(data: CreateUserData): Promise<UserDocument> {
    const now = new Date();
    const doc: Omit<UserDocument, '_id'> = {
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      preferences: {
        defaultSummarizedFolder: null,
        defaultMemorizedFolder: null,
        theme: 'system',
      },
      usage: {
        videosThisMonth: 0,
        videosResetAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(doc as UserDocument);
    return { ...doc, _id: result.insertedId } as UserDocument;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { lastLoginAt: new Date() } }
    );
  }

  async update(userId: string, updates: Partial<Omit<UserDocument, '_id'>>): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }
}
