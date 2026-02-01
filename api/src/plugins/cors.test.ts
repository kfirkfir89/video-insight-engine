import { describe, it, expect } from 'vitest';
import { config } from '../config.js';

describe('CORS plugin', () => {
  it('should use ALLOWED_ORIGINS from config', () => {
    // Verify config.ALLOWED_ORIGINS exists and includes expected origins
    expect(config.ALLOWED_ORIGINS).toBeDefined();
    expect(Array.isArray(config.ALLOWED_ORIGINS)).toBe(true);
    expect(config.ALLOWED_ORIGINS.length).toBeGreaterThan(0);

    // Should include FRONTEND_URL
    expect(config.ALLOWED_ORIGINS).toContain(config.FRONTEND_URL);
  });

  it('should include localhost origins in development', () => {
    // In test environment (which mimics dev), localhost should be included
    const hasLocalhost = config.ALLOWED_ORIGINS.some(
      origin => origin.includes('localhost')
    );
    expect(hasLocalhost).toBe(true);
  });
});
