// ═══════════════════════════════════════════════════
// API Response & Error Types
// ═══════════════════════════════════════════════════

import type { User } from './user.js';
import type { FolderType, ProcessingStatus, TargetType } from './common.js';

// ─────────────────────────────────────────────────────
// API Responses
// ─────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: Pick<User, 'email' | 'name'> & { id: string };
}

export interface FolderResponse {
  id: string;
  name: string;
  type: FolderType;
  parentId: string | null;
  path: string;
  level: number;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────
// WebSocket Event Types
// ─────────────────────────────────────────────────────

export interface VideoStatusEvent {
  type: 'video.status';
  payload: {
    videoSummaryId: string;
    userVideoId: string;
    youtubeId: string;
    status: ProcessingStatus;
    progress: number;
    message?: string;
    error?: string;
  };
}

export interface VideoMetadataEvent {
  type: 'video.metadata';
  payload: {
    videoSummaryId: string;
    title: string;
    channel?: string;
    thumbnailUrl?: string;
    duration?: number;
  };
}

export interface ExpansionStatusEvent {
  type: 'expansion.status';
  payload: {
    videoSummaryId: string;
    targetType: TargetType;
    targetId: string;
    status: ProcessingStatus;
    error?: string;
  };
}

export type WebSocketEvent = VideoStatusEvent | VideoMetadataEvent | ExpansionStatusEvent;

// ─────────────────────────────────────────────────────
// SSE Event Types
// ─────────────────────────────────────────────────────

export interface SSEDoneEvent {
  event: 'done';
  videoSummaryId: string;
  processingTimeMs?: number;
  cached?: boolean;
}

export interface SSEPhaseEvent {
  event: 'phase';
  phase: string;
}

export interface SSETokenEvent {
  event: 'token';
  phase: string;
  token: string;
}

export interface SSEErrorEvent {
  event: 'error';
  message: string;
  code?: string;
}

// ─────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export const ErrorCodes = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  REFRESH_EXPIRED: 'REFRESH_EXPIRED',

  // Video
  INVALID_YOUTUBE_URL: 'INVALID_YOUTUBE_URL',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  NO_TRANSCRIPT: 'NO_TRANSCRIPT',
  VIDEO_TOO_LONG: 'VIDEO_TOO_LONG',
  VIDEO_TOO_SHORT: 'VIDEO_TOO_SHORT',
  VIDEO_UNAVAILABLE: 'VIDEO_UNAVAILABLE',

  // Playlist
  INVALID_PLAYLIST_URL: 'INVALID_PLAYLIST_URL',
  PLAYLIST_NOT_FOUND: 'PLAYLIST_NOT_FOUND',
  PLAYLIST_EXTRACTION_FAILED: 'PLAYLIST_EXTRACTION_FAILED',
  PLAYLIST_TOO_LARGE: 'PLAYLIST_TOO_LARGE',
  URL_MODE_MISMATCH: 'URL_MODE_MISMATCH',

  // Share
  SHARE_NOT_FOUND: 'SHARE_NOT_FOUND',
  SHARE_ALREADY_EXISTS: 'SHARE_ALREADY_EXISTS',

  // Tier & Payment
  TIER_LIMIT_EXCEEDED: 'TIER_LIMIT_EXCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',

  // General
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
