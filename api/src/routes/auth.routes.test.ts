import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, getAuthHeader, type MockContainer } from '../test/helpers.js';

describe('auth routes', () => {
  let app: FastifyInstance;
  let mockContainer: MockContainer;
  let authHeader: string;

  beforeAll(async () => {
    mockContainer = createMockContainer();
    app = await buildTestApp(mockContainer);
    await app.ready();
    authHeader = await getAuthHeader(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const mockUser = { id: 'u1', email: 'new@example.com' };
      mockContainer.authService.register.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'new@example.com',
          password: 'SecurePass123',  // Must have uppercase, lowercase, number
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.authService.register).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'SecurePass123',
        name: 'Test User',
      });
      const body = response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('expiresIn');
      expect(body).toHaveProperty('user', mockUser);
    });

    it('should return 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'invalid-email',
          password: 'SecurePass123',
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'test@example.com',
          password: '123',
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 409 when email already exists', async () => {
      const { EmailExistsError } = await import('../utils/errors.js');
      mockContainer.authService.register.mockRejectedValue(new EmailExistsError());

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'existing@example.com',
          password: 'SecurePass123',
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login an existing user', async () => {
      const mockUser = { id: 'u1', email: 'user@example.com' };
      mockContainer.authService.login.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'user@example.com',
          password: 'correctPassword',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.authService.login).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'correctPassword',
      });
      const body = response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('expiresIn');
      expect(body).toHaveProperty('user', mockUser);
    });

    it('should return 401 for invalid credentials', async () => {
      const { InvalidCredentialsError } = await import('../utils/errors.js');
      mockContainer.authService.login.mockRejectedValue(new InvalidCredentialsError());

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'user@example.com',
          password: 'wrongPassword',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'user@example.com',
          // missing password
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 401 when no refresh token cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear refresh token cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
      // Check that set-cookie header clears the refreshToken
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      mockContainer.authService.getUser.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.authService.getUser).toHaveBeenCalledWith('test-user-id');
      expect(response.json()).toEqual(mockUser);
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 when user not found', async () => {
      const { UserNotFoundError } = await import('../utils/errors.js');
      mockContainer.authService.getUser.mockRejectedValue(new UserNotFoundError());

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
