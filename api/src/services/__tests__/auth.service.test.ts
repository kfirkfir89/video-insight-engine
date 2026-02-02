import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import { AuthService } from '../auth.service.js';
import { UserRepository, UserDocument } from '../../repositories/user.repository.js';
import {
  EmailExistsError,
  InvalidCredentialsError,
  UserNotFoundError,
} from '../../utils/errors.js';

// Mock bcrypt module
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

// Mock logger for tests
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => mockLogger),
  level: 'silent',
  silent: vi.fn(),
} as unknown as FastifyBaseLogger;

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: {
    findById: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateLastLogin: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  const createMockUser = (overrides: Partial<UserDocument> = {}): UserDocument => {
    const now = new Date();
    return {
      _id: new ObjectId(),
      email: 'test@example.com',
      passwordHash: '$2b$10$hashedpassword',
      name: 'Test User',
      preferences: {
        defaultSummarizedFolder: null,
        defaultMemorizedFolder: null,
        theme: 'system' as const,
      },
      usage: {
        videosThisMonth: 0,
        videosResetAt: now,
      },
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUserRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      updateLastLogin: vi.fn(),
      update: vi.fn(),
    };

    authService = new AuthService(
      mockUserRepository as unknown as UserRepository,
      mockLogger
    );
  });

  describe('register', () => {
    const validInput = {
      email: 'newuser@example.com',
      password: 'SecurePass123',
      name: 'New User',
    };

    it('should successfully register a new user', async () => {
      const hashedPassword = '$2b$10$mockedhashvalue';
      const mockUser = createMockUser({
        email: validInput.email,
        name: validInput.name,
        passwordHash: hashedPassword,
      });

      mockUserRepository.findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);
      mockUserRepository.create.mockResolvedValue(mockUser);

      const result = await authService.register(validInput);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validInput.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(validInput.password, 10);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: validInput.email,
        passwordHash: hashedPassword,
        name: validInput.name,
      });
      expect(result).toEqual({
        id: mockUser._id.toString(),
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('should throw EmailExistsError when email already exists', async () => {
      const existingUser = createMockUser({ email: validInput.email });
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(authService.register(validInput)).rejects.toThrow(EmailExistsError);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validInput.email);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should hash password with salt rounds of 10', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashed' as never);
      mockUserRepository.create.mockResolvedValue(createMockUser());

      await authService.register(validInput);

      expect(bcrypt.hash).toHaveBeenCalledWith(validInput.password, 10);
    });

    it('should return user data without password hash', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashed' as never);
      mockUserRepository.create.mockResolvedValue(mockUser);

      const result = await authService.register(validInput);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
    });
  });

  describe('login', () => {
    const validInput = {
      email: 'test@example.com',
      password: 'SecurePass123',
    };

    it('should successfully login with valid credentials', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockUserRepository.updateLastLogin.mockResolvedValue(undefined);

      const result = await authService.login(validInput);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validInput.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(validInput.password, mockUser.passwordHash);
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser._id.toString());
      expect(result).toEqual({
        id: mockUser._id.toString(),
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('should throw InvalidCredentialsError when user does not exist', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(validInput)).rejects.toThrow(InvalidCredentialsError);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validInput.email);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
    });

    it('should throw InvalidCredentialsError when password is incorrect', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.login(validInput)).rejects.toThrow(InvalidCredentialsError);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validInput.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(validInput.password, mockUser.passwordHash);
      expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
    });

    it('should update last login timestamp on successful login', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockUserRepository.updateLastLogin.mockResolvedValue(undefined);

      await authService.login(validInput);

      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser._id.toString());
    });

    it('should return user data without password hash', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockUserRepository.updateLastLogin.mockResolvedValue(undefined);

      const result = await authService.login(validInput);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
    });

    it('should use same error for non-existent user and wrong password', async () => {
      // Test non-existent user
      mockUserRepository.findByEmail.mockResolvedValue(null);
      const errorNoUser = await authService.login(validInput).catch((e) => e);

      // Test wrong password
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      const errorWrongPass = await authService.login(validInput).catch((e) => e);

      // Both should be InvalidCredentialsError (security: don't reveal which is wrong)
      expect(errorNoUser).toBeInstanceOf(InvalidCredentialsError);
      expect(errorWrongPass).toBeInstanceOf(InvalidCredentialsError);
      expect(errorNoUser.message).toBe(errorWrongPass.message);
    });
  });

  describe('getUser', () => {
    it('should return user data for valid user ID', async () => {
      const userId = new ObjectId().toString();
      const mockUser = createMockUser({ _id: new ObjectId(userId) });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getUser(userId);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        id: mockUser._id.toString(),
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      const userId = new ObjectId().toString();
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.getUser(userId)).rejects.toThrow(UserNotFoundError);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should return user data without password hash', async () => {
      const userId = new ObjectId().toString();
      const mockUser = createMockUser({ _id: new ObjectId(userId) });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getUser(userId);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
    });
  });

  describe('password hashing', () => {
    it('should use bcrypt for password hashing', async () => {
      const password = 'SecurePass123';
      const hashedPassword = '$2b$10$somehashedvalue';

      mockUserRepository.findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);
      mockUserRepository.create.mockResolvedValue(createMockUser());

      await authService.register({
        email: 'test@example.com',
        password,
        name: 'Test',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    });

    it('should use bcrypt compare for password verification', async () => {
      const password = 'SecurePass123';
      const mockUser = createMockUser();

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockUserRepository.updateLastLogin.mockResolvedValue(undefined);

      await authService.login({ email: 'test@example.com', password });

      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.passwordHash);
    });
  });

  describe('error handling', () => {
    it('should propagate repository errors during registration', async () => {
      const dbError = new Error('Database connection failed');
      mockUserRepository.findByEmail.mockRejectedValue(dbError);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'SecurePass123',
          name: 'Test',
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate repository errors during login', async () => {
      const dbError = new Error('Database connection failed');
      mockUserRepository.findByEmail.mockRejectedValue(dbError);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'SecurePass123',
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate repository errors during getUser', async () => {
      const dbError = new Error('Database connection failed');
      const userId = new ObjectId().toString();
      mockUserRepository.findById.mockRejectedValue(dbError);

      await expect(authService.getUser(userId)).rejects.toThrow('Database connection failed');
    });

    it('should propagate bcrypt errors during registration', async () => {
      const bcryptError = new Error('Bcrypt internal error');
      mockUserRepository.findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockRejectedValue(bcryptError as never);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'SecurePass123',
          name: 'Test',
        })
      ).rejects.toThrow('Bcrypt internal error');
    });

    it('should propagate bcrypt errors during login', async () => {
      const bcryptError = new Error('Bcrypt internal error');
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockRejectedValue(bcryptError as never);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'SecurePass123',
        })
      ).rejects.toThrow('Bcrypt internal error');
    });
  });
});
