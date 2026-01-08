// Re-export types from shared package
export type {
  ProcessingStatus,
  FolderType,
  SourceType,
  TargetType,
  Section,
  Concept,
  VideoSummary,
  AuthResponse,
  VideoResponse,
  FolderResponse,
  VideoStatusEvent,
  ExpansionStatusEvent,
  WebSocketEvent,
  ApiError,
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
