// Re-export types from shared package
export type {
  ProcessingStatus,
  AuthResponse,
  VideoResponse,
  VideoContext,
  FolderResponse,
  VideoStatusEvent,
  ExpansionStatusEvent,
  WebSocketEvent,
  ApiError,
  // Transcript types
  TranscriptSource,
  TranscriptSegment,
  // Playlist types
  PlaylistMode,
  PlaylistInfo,
  PlaylistVideo,
  PlaylistPreview,
  PlaylistImportVideo,
  PlaylistImportResult,
} from "@vie/types";

export { ErrorCodes } from "@vie/types";

// Local type aliases for convenience
export type User = {
  id: string;
  email: string;
  name: string;
};

export type Video = VideoResponse;
export type Folder = FolderResponse;

// Import the type for use in alias
import type { VideoResponse, FolderResponse } from "@vie/types";

// Folder input types (used by API layer)
export interface CreateFolderInput {
  name: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}
