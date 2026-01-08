import { FastifyInstance } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { config } from '../config.js';

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify.mongo.db);

  // POST /api/auth/register
  fastify.post('/register', {
    config: {
      rateLimit: { max: 5, timeWindow: '1 hour' },
    },
  }, async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const user = await authService.register(input);

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
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.code(201).send({
      accessToken,
      expiresIn: 900,
      user,
    });
  });

  // POST /api/auth/login
  fastify.post('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const user = await authService.login(input);

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
      maxAge: 7 * 24 * 60 * 60,
    });

    return { accessToken, expiresIn: 900, user };
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (req, reply) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return reply.code(401).send({ error: 'REFRESH_EXPIRED' });
    }

    try {
      const payload = fastify.jwt.verify<{ userId: string }>(refreshToken);
      const accessToken = fastify.jwt.sign(
        { userId: payload.userId },
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return { accessToken, expiresIn: 900 };
    } catch {
      reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return reply.code(401).send({ error: 'REFRESH_EXPIRED' });
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
