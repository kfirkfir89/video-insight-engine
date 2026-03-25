/**
 * Re-export ErrorBoundary from react-error-boundary.
 * Keeps the import path stable for all existing consumers.
 *
 * Issue #13: Prevents malformed streaming state from crashing the entire app.
 */

export { ErrorBoundary } from "react-error-boundary";
export type { FallbackProps } from "react-error-boundary";
