import { FastifyInstance } from 'fastify';
import { checkoutQuerySchema, webhookBodySchema } from '../schemas/payment.schema.js';
import { InvalidWebhookError } from '../utils/errors.js';
import { config } from '../config.js';

export async function paymentRoutes(fastify: FastifyInstance) {
  const { paymentService } = fastify.container;

  // POST /api/payments/webhook — Paddle webhook handler
  fastify.post('/webhook', {
    config: {
      // Raw body needed for signature verification
      rawBody: true,
    },
  }, async (req, reply) => {
    const signature = req.headers['paddle-signature'] as string
      || req.headers['x-paddle-signature'] as string
      || '';

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // Verify signature — skip only when no secret is configured (safe for local dev)
    if (config.PADDLE_WEBHOOK_SECRET) {
      const valid = paymentService.verifyWebhook(rawBody, signature);
      if (!valid) {
        throw new InvalidWebhookError();
      }
    } else {
      req.log.warn('Webhook signature verification skipped — no PADDLE_WEBHOOK_SECRET configured');
    }

    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = webhookBodySchema.parse(raw);
    await paymentService.handleWebhookEvent(event);

    return reply.code(200).send({ received: true });
  });

  // GET /api/payments/checkout — generate checkout URL (auth required)
  fastify.get<{
    Querystring: { tier: string };
  }>('/checkout', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
      },
    },
  }, async (req) => {
    const { tier } = checkoutQuerySchema.parse(req.query);
    const url = await paymentService.generateCheckoutUrl(req.user.userId, tier);
    return { checkoutUrl: url };
  });

  // GET /api/payments/tier — current user tier + limits
  fastify.get('/tier', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
      },
    },
  }, async (req) => {
    return paymentService.getUserTier(req.user.userId);
  });
}
