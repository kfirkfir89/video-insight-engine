import { Db, ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';
import { EmailExistsError, InvalidCredentialsError, UserNotFoundError } from '../utils/errors.js';

export class AuthService {
  constructor(private db: Db) {}

  async register(input: RegisterInput) {
    const existing = await this.db.collection('users').findOne({ email: input.email });
    if (existing) {
      throw new EmailExistsError();
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const result = await this.db.collection('users').insertOne({
      email: input.email,
      passwordHash,
      name: input.name,
      preferences: {
        defaultSummarizedFolder: null,
        defaultMemorizedFolder: null,
        theme: 'system',
      },
      usage: {
        videosThisMonth: 0,
        videosResetAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      id: result.insertedId.toString(),
      email: input.email,
      name: input.name,
    };
  }

  async login(input: LoginInput) {
    const user = await this.db.collection('users').findOne({ email: input.email });
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    await this.db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } }
    );

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  }

  async getUser(userId: string) {
    const user = await this.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw new UserNotFoundError();
    }

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  }
}
