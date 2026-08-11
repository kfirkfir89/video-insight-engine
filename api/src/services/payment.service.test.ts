import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { PaymentService } from './payment.service.js';
import { config } from '../config.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { VideoRepository } from '../repositories/video.repository.js';
import type { FastifyBaseLogger } from 'fastify';

function signWebhook(rawBody: string, tsSeconds: number, secret: string = config.PADDLE_WEBHOOK_SECRET): string {
  const h1 = createHmac('sha256', secret).update(`${tsSeconds}:${rawBody}`).digest('hex');
  return `ts=${tsSeconds};h1=${h1}`;
}

describe('PaymentService', () => {
  describe('verifyWebhook', () => {
    let service: PaymentService;
    const rawBody = '{"event_type":"subscription.created","data":{"customer_id":"cust_1"}}';
    const nowSeconds = Math.floor(Date.now() / 1000);

    beforeEach(() => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
      };
      service = new PaymentService(
        {} as unknown as UserRepository,
        {} as unknown as VideoRepository,
        mockLogger as unknown as FastifyBaseLogger
      );
    });

    it('should accept a correctly signed fresh webhook', () => {
      const signature = signWebhook(rawBody, nowSeconds);
      expect(service.verifyWebhook(rawBody, signature)).toBe(true);
    });

    it('should accept a signature just inside the 5-minute freshness window', () => {
      const signature = signWebhook(rawBody, nowSeconds - 290);
      expect(service.verifyWebhook(rawBody, signature)).toBe(true);
    });

    it('should reject a validly signed webhook older than 5 minutes (replay)', () => {
      const signature = signWebhook(rawBody, nowSeconds - 301);
      expect(service.verifyWebhook(rawBody, signature)).toBe(false);
    });

    it('should reject a signature computed with the wrong secret', () => {
      const signature = signWebhook(rawBody, nowSeconds, 'attacker-controlled-secret');
      expect(service.verifyWebhook(rawBody, signature)).toBe(false);
    });

    it('should reject a signature over a tampered body', () => {
      const signature = signWebhook(rawBody, nowSeconds);
      const tampered = rawBody.replace('cust_1', 'cust_2');
      expect(service.verifyWebhook(tampered, signature)).toBe(false);
    });

    it('should reject a signature missing the ts component', () => {
      const h1 = createHmac('sha256', config.PADDLE_WEBHOOK_SECRET)
        .update(`${nowSeconds}:${rawBody}`)
        .digest('hex');
      expect(service.verifyWebhook(rawBody, `h1=${h1}`)).toBe(false);
    });

    it('should reject a non-numeric ts component', () => {
      expect(service.verifyWebhook(rawBody, 'ts=not-a-number;h1=deadbeef')).toBe(false);
    });

    it('should reject an empty signature header', () => {
      expect(service.verifyWebhook(rawBody, '')).toBe(false);
    });
  });
});
