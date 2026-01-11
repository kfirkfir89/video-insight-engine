import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { config } from '../config.js';
import { UnauthorizedError } from '../utils/errors.js';

const ACCESS_TOKEN_EXPIRY_SECONDS = 900;
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

interface TokenUser {
  id: string;
  email: string;
}

/**
 * Generate access and refresh tokens, set refresh token cookie
 */
function generateAuthTokens(
  fastify: FastifyInstance,
  reply: FastifyReply,
  user: TokenUser
): { accessToken: string; expiresIn: number } {
  const accessToken = fastify.jwt.sign(
    { userId: user.id, email: user.email },
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  const refreshToken = fastify.jwt.sign(
    { userId: user.id },
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
  );

  reply.setCookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return { accessToken, expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS };
}

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify.mongo.db);

  // POST /api/auth/register
  fastify.post<{
    Body: z.infer<typeof registerSchema>;
  }>('/register', {
    config: {
      rateLimit: { max: 5, timeWindow: '1 hour' },
    },
  }, async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const user = await authService.register(input);
    const tokens = generateAuthTokens(fastify, reply, user);
    return reply.code(201).send({ ...tokens, user });
  });

  // POST /api/auth/login
  fastify.post<{
    Body: z.infer<typeof loginSchema>;
  }>('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const user = await authService.login(input);
    const tokens = generateAuthTokens(fastify, reply, user);
    return { ...tokens, user };
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (req, reply) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token expired');
    }

    try {
      const payload = fastify.jwt.verify<{ userId: string }>(refreshToken);
      const accessToken = fastify.jwt.sign(
        { userId: payload.userId },
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return { accessToken, expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS };
    } catch {
      reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      throw new UnauthorizedError('Refresh token expired');
    }
  });

  // POST /api/auth/logout
  fastify.post('/logout', async (req, reply) => {
    reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return { success: true };
  });

  // GET /api/auth/me
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    return authService.getUser(req.user.userId);
  });
}
