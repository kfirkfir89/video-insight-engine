import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { disableSocketInactivityTimeout } from './sse.js';

function fakeRequest(socket: unknown): FastifyRequest {
  return { raw: { socket } } as unknown as FastifyRequest;
}

describe('disableSocketInactivityTimeout', () => {
  it('should set the socket timeout to 0 (no inactivity limit)', () => {
    const setTimeoutSpy = vi.fn();
    disableSocketInactivityTimeout(fakeRequest({ setTimeout: setTimeoutSpy }));
    expect(setTimeoutSpy).toHaveBeenCalledWith(0);
  });

  it('should be a no-op when the socket has no setTimeout (light-my-request fake)', () => {
    expect(() => disableSocketInactivityTimeout(fakeRequest({}))).not.toThrow();
  });

  it('should be a no-op when there is no socket at all', () => {
    expect(() => disableSocketInactivityTimeout(fakeRequest(undefined))).not.toThrow();
  });
});
