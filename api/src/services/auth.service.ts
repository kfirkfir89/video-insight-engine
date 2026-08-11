import { FastifyBaseLogger } from 'fastify';
import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository.js';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';
import {
  AccountDeletionPendingError,
  EmailExistsError,
  InvalidCredentialsError,
  UserNotFoundError,
} from '../utils/errors.js';

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: FastifyBaseLogger
  ) {}

  async register(input: RegisterInput) {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new EmailExistsError();
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.userRepository.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  }

  async login(input: LoginInput) {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    // Reject login for accounts in the soft-delete grace window. Returning
    // 403 (not 401) tells the frontend to redirect to the recovery flow
    // instead of prompting for credentials again.
    if (user.deletedAt) {
      throw new AccountDeletionPendingError();
    }

    await this.userRepository.updateLastLogin(user._id.toString());

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  }

  async getUser(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (user.deletedAt) {
      throw new AccountDeletionPendingError();
    }

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  }
}
