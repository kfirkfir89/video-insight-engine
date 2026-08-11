import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { config } from '../config.js';
import { UnauthorizedError } from '../utils/errors.js';
import { isValidInternalSecret } from '../utils/internal-auth.js';
import * as softDeleteCache from '../utils/soft-delete-cache.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /**
     * Internal service-to-service auth. Validates `X-Internal-Secret` against
     * `config.INTERNAL_SECRET` and trusts the caller-supplied `X-User-Id` as the
     * acting user (the assistant derives it from its own validated request). Used
     * by `/internal/assistant/*` routes that existing services scope by userId.
     */
    authenticateInternal: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyContextConfig {
    /**
     * When set, the `authenticate` decorator skips the soft-delete grace-window
     * check. Used by `DELETE /api/users/me` so a re-request can reach the
     * service and return the more specific 409 `ACCOUNT_ALREADY_DELETED`
     * instead of the generic 403 from this hook.
     */
    skipSoftDeleteCheck?: boolean;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email?: string; type?: 'access' | 'refresh' };
    user: { userId: string; email?: string; type?: 'access' | 'refresh' };
  }
  interface JWT {
    /**
     * Refresh-token namespace registered with `JWT_REFRESH_SECRET`. Signing
     * and verifying refresh tokens through `fastify.jwt.refresh` keeps them
     * cryptographically separate from access tokens — a stolen access token
     * cannot be replayed against `/api/auth/refresh` to self-renew forever.
     *
     * Typed as `this` (the JWT interface itself) — declaration emit rejects a
     * direct `JWT` reference inside an augmentation of an `export =` module.
     */
    refresh: this;
  }
}

async function jwt(fastify: FastifyInstance) {
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  // Separate secret + namespace for refresh tokens (see JWT augmentation above).
  await fastify.register(fastifyJwt, {
    secret: config.JWT_REFRESH_SECRET,
    namespace: 'refresh',
    sign: { expiresIn: config.JWT_REFRESH_EXPIRES_IN },
  });

  // Standardized error envelope + codes per docs/ERROR-HANDLING.md:
  // UNAUTHORIZED (no token) / TOKEN_EXPIRED (renewable — FE should hit
  // /api/auth/refresh) / TOKEN_INVALID (malformed/tampered — FE should log
  // out). Distinguishing expired from invalid leaks nothing (the client
  // holds the token) and lets the FE auto-refresh instead of hard-logout.
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch (err) {
      const jwtErrorCode =
        err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
          ? err.code
          : undefined;

      if (jwtErrorCode === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401,
        });
      }
      if (jwtErrorCode === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
        return reply.code(401).send({
          error: 'TOKEN_EXPIRED',
          message: 'Token has expired',
          statusCode: 401,
        });
      }
      return reply.code(401).send({
        error: 'TOKEN_INVALID',
        message: 'Invalid token',
        statusCode: 401,
      });
    }

    // Token-type confusion guard: refresh tokens must never authenticate API
    // requests. Legacy tokens issued before the `type` claim existed carry no
    // `type` and are still accepted as access tokens — a deliberate migration
    // window that closes once every pre-rollout token has expired (15m for
    // access, 7d for refresh). See docs/SECURITY.md "Token type claim".
    if (req.user.type === 'refresh') {
      return reply.code(401).send({
        error: 'TOKEN_INVALID',
        message: 'Invalid token',
        statusCode: 401,
      });
    }

    // Routes that need to surface their own deletion-state error code opt out
    // of the hook-level guard via `config: { skipSoftDeleteCheck: true }`.
    if (req.routeOptions?.config?.skipSoftDeleteCheck) {
      return;
    }

    // GDPR soft-delete guard. A previously-issued JWT remains
    // cryptographically valid for its TTL, so we must check on every request
    // whether the user is still active. Skip in tests where the container
    // (and therefore `userRepository`) may not be wired up.
    const container = (fastify as FastifyInstance).container;
    if (!container?.userRepository) {
      return;
    }

    const userId = req.user.userId;
    let isDeleted = softDeleteCache.get(userId);

    if (isDeleted === null) {
      try {
        const user = await container.userRepository.findById(userId);
        isDeleted = !!user?.deletedAt;
        softDeleteCache.set(userId, isDeleted);
      } catch (err) {
        // Fail open on a transient DB error so we don't lock every user out
        // during a Mongo blip, but make it visible in logs so on-call can
        // correlate any abuse window during an incident.
        req.log.warn(
          { err, userId },
          'soft_delete_check_db_error',
        );
        return;
      }
    }

    if (isDeleted) {
      return reply.code(403).send({
        error: 'ACCOUNT_DELETION_PENDING',
        message: 'This account is scheduled for deletion. Contact support to cancel.',
        statusCode: 403,
      });
    }
  });

  fastify.decorate('authenticateInternal', async (req: FastifyRequest) => {
    if (!isValidInternalSecret(req.headers['x-internal-secret'])) {
      throw new UnauthorizedError('Invalid internal secret');
    }

    const userIdHeader = req.headers['x-user-id'];
    const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
    if (!userId) {
      throw new UnauthorizedError('Missing X-User-Id');
    }

    req.user = { userId };
  });
}

export const jwtPlugin = fp(jwt);
