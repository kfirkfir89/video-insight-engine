import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, getAuthHeader, type MockContainer } from '../test/helpers.js';

describe('payment routes', () => {
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

  describe('POST /api/payments/webhook', () => {
    it('should handle valid webhook event and return 200', async () => {
      mockContainer.paymentService.verifyWebhook.mockReturnValue(true);
      mockContainer.paymentService.handleWebhookEvent.mockResolvedValue(undefined);

      const webhookPayload = {
        event_type: 'subscription.created',
        data: { subscription_id: 'sub_123', customer_id: 'cust_456' },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/webhook',
        headers: {
          'content-type': 'application/json',
          'paddle-signature': 'valid-signature',
        },
        payload: webhookPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: true });
      expect(mockContainer.paymentService.handleWebhookEvent).toHaveBeenCalledWith(webhookPayload);
    });

    it('should not require authentication', async () => {
      mockContainer.paymentService.verifyWebhook.mockReturnValue(true);
      mockContainer.paymentService.handleWebhookEvent.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/webhook',
        headers: { 'content-type': 'application/json' },
        payload: {
          event_type: 'subscription.updated',
          data: { subscription_id: 'sub_789' },
        },
      });

      // Should succeed without auth header
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/payments/checkout', () => {
    it('should return checkout URL for authenticated user', async () => {
      const mockUrl = 'https://checkout.paddle.com/session/abc123';
      mockContainer.paymentService.generateCheckoutUrl.mockResolvedValue(mockUrl);

      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/checkout?tier=pro',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ checkoutUrl: mockUrl });
      expect(mockContainer.paymentService.generateCheckoutUrl).toHaveBeenCalledWith(
        'test-user-id',
        'pro'
      );
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/checkout?tier=pro',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept tier=team as valid', async () => {
      const mockUrl = 'https://checkout.paddle.com/session/team456';
      mockContainer.paymentService.generateCheckoutUrl.mockResolvedValue(mockUrl);

      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/checkout?tier=team',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ checkoutUrl: mockUrl });
      expect(mockContainer.paymentService.generateCheckoutUrl).toHaveBeenCalledWith(
        'test-user-id',
        'team'
      );
    });

    it('should return 400 for invalid tier param', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/checkout?tier=invalid',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when tier param is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/checkout',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/payments/tier', () => {
    it('should return tier and limits for authenticated user', async () => {
      const mockTierInfo = {
        tier: 'free',
        limits: {
          videosPerDay: 3,
          chatPerOutput: 5,
          shareEnabled: true,
          exportEnabled: false,
        },
      };
      mockContainer.paymentService.getUserTier.mockResolvedValue(mockTierInfo);

      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/tier',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockTierInfo);
      expect(mockContainer.paymentService.getUserTier).toHaveBeenCalledWith('test-user-id');
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/tier',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return pro tier info when user is on pro plan', async () => {
      const proTierInfo = {
        tier: 'pro',
        limits: {
          videosPerDay: 25,
          chatPerOutput: 50,
          shareEnabled: true,
          exportEnabled: true,
        },
      };
      mockContainer.paymentService.getUserTier.mockResolvedValue(proTierInfo);

      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/tier',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(proTierInfo);
    });
  });
});
