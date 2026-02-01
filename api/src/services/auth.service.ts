import { FastifyBaseLogger } from 'fastify';
import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository.js';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';
import { EmailExistsError, InvalidCredentialsError, UserNotFoundError } from '../utils/errors.js';

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

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  }
}
