import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { config } from '../config.js';
import * as softDeleteCache from '../utils/soft-delete-cache.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
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
    payload: { userId: string; email?: string };
    user: { userId: string; email?: string };
  }
}

async function jwt(fastify: FastifyInstance) {
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  // Issue #9: Standardized error response format per ERROR-HANDLING.md
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch (err) {
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
        statusCode: 401
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
}

export const jwtPlugin = fp(jwt);
