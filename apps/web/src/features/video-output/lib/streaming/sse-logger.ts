/**
 * SSE-specific logger that only logs in development mode.
 *
 * Prevents noisy validation warnings in production while keeping
 * debugging capability during development. Error-level messages
 * always log since they indicate real problems.
 */

const isDev = import.meta.env.DEV;

export const sseLogger = {
  /**
   * Log a warning message (dev only).
   * Use for validation failures that have safe fallbacks.
   */
  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.warn(`[SSE] ${message}`, ...args);
    }
  },

  /**
   * Log an error message (always logs).
   * Use for errors that indicate real problems.
   */
  error: (message: string, ...args: unknown[]) => {
    console.error(`[SSE] ${message}`, ...args);
  },
};
