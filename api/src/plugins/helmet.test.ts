import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { helmetPlugin } from './helmet.js';
import { config } from '../config.js';

describe('Helmet plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(helmetPlugin);

    app.get('/test', async () => ({ status: 'ok' }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Content-Security-Policy header', () => {
    it('should set Content-Security-Policy header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('should include default-src directive', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const csp = response.headers['content-security-policy'] as string;
      expect(csp).toContain("default-src 'self'");
    });

    it('should include script-src directive', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const csp = response.headers['content-security-policy'] as string;
      expect(csp).toContain("script-src 'self'");
    });

    it('should allow unsafe-inline for styles', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const csp = response.headers['content-security-policy'] as string;
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should allow data: and https: for images', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const csp = response.headers['content-security-policy'] as string;
      expect(csp).toContain("img-src 'self' data: https:");
    });

    it('should allow YouTube in frame-src for embeds', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const csp = response.headers['content-security-policy'] as string;
      expect(csp).toContain('frame-src');
      expect(csp).toContain('https://www.youtube.com');
    });

    it('should allow configured origins in connect-src', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const csp = response.headers['content-security-policy'] as string;
      expect(csp).toContain('connect-src');
      expect(csp).toContain("'self'");
    });

    it('should block object embeds', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const csp = response.headers['content-security-policy'] as string;
      expect(csp).toContain("object-src 'none'");
    });
  });

  describe('HSTS header', () => {
    it('should set Strict-Transport-Security header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should set max-age to one year', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const hsts = response.headers['strict-transport-security'] as string;
      expect(hsts).toContain('max-age=31536000');
    });

    it('should include includeSubDomains directive', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const hsts = response.headers['strict-transport-security'] as string;
      expect(hsts).toContain('includeSubDomains');
    });

    it('should include preload directive', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const hsts = response.headers['strict-transport-security'] as string;
      expect(hsts).toContain('preload');
    });
  });

  describe('Referrer-Policy header', () => {
    it('should set Referrer-Policy header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers).toHaveProperty('referrer-policy');
    });

    it('should use strict-origin-when-cross-origin policy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('X-Content-Type-Options header', () => {
    it('should set X-Content-Type-Options header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers).toHaveProperty('x-content-type-options');
    });

    it('should be set to nosniff', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('X-Frame-Options header', () => {
    it('should set X-Frame-Options header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('X-Download-Options header', () => {
    it('should set X-Download-Options header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers).toHaveProperty('x-download-options');
    });

    it('should be set to noopen', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['x-download-options']).toBe('noopen');
    });
  });

  describe('X-DNS-Prefetch-Control header', () => {
    it('should set X-DNS-Prefetch-Control header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers).toHaveProperty('x-dns-prefetch-control');
    });
  });

  describe('Cross-Origin headers', () => {
    it('should not set Cross-Origin-Embedder-Policy (disabled for YouTube)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      // Should not have COEP as it's disabled for YouTube embeds
      expect(response.headers['cross-origin-embedder-policy']).toBeUndefined();
    });

    it('should set Cross-Origin-Opener-Policy header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers).toHaveProperty('cross-origin-opener-policy');
    });

    it('should set Cross-Origin-Resource-Policy header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers).toHaveProperty('cross-origin-resource-policy');
    });
  });

  describe('Origin-Agent-Cluster header', () => {
    it('should set Origin-Agent-Cluster header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      // Helmet sets origin-agent-cluster by default
      expect(response.headers).toHaveProperty('origin-agent-cluster');
    });
  });

  describe('X-Powered-By header', () => {
    it('should remove X-Powered-By header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});
