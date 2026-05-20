/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sonner BEFORE importing the helper — `import('sonner')` inside the
// helper must resolve to our spy.
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: vi.fn(),
  },
}));

import { showDuplicateToast } from '../duplicate-toast';

describe('showDuplicateToast', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
  });

  it('emits a success toast informing the user the submission was deduped', async () => {
    await showDuplicateToast();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/already processed/i));
  });

  it('is safe to call without arguments (idempotent invocation surface)', async () => {
    await expect(showDuplicateToast()).resolves.toBeUndefined();
  });
});
