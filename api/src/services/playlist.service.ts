import { Db, ObjectId } from 'mongodb';
import { config } from '../config.js';
import { extractPlaylistId } from '../utils/youtube.js';
import {
  InvalidPlaylistUrlError,
  PlaylistNotFoundError,
  PlaylistExtractionError,
  FolderNotFoundError,
} from '../utils/errors.js';
import { createFolder } from './folder.service.js';
import { VideoService } from './video.service.js';
import type { ProviderConfig } from './summarizer-client.js';

// Logger for debugging
const logger = {
  info: (msg: string, context?: unknown) => console.info(`[PlaylistService] ${msg}`, context ?? ''),
  warn: (msg: string, context?: unknown) => console.warn(`[PlaylistService] ${msg}`, context ?? ''),
  error: (msg: string, context?: unknown) => console.error(`[PlaylistService] ${msg}`, context ?? ''),
};

// Types for summarizer response
interface SummarizerPlaylistVideo {
  video_id: string;
  title: string;
  position: number;
  duration: number | null;
  thumbnail_url: string | null;
}

interface SummarizerPlaylistResponse {
  playlist_id: string;
  title: string;
  channel: string | null;
  thumbnail_url: string | null;
  total_videos: number;
  videos: SummarizerPlaylistVideo[];
}

// Public types
export interface PlaylistVideo {
  videoId: string;
  title: string;
  position: number;
  duration: number | null;
  thumbnailUrl: string | null;
  isCached: boolean;
}

export interface PlaylistPreview {
  playlistId: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  totalVideos: number;
  videos: PlaylistVideo[];
  cachedCount: number;
}

export interface PlaylistInfo {
  playlistId: string;
  playlistTitle: string;
  position: number;
  totalVideos: number;
}

export interface FailedVideoImport {
  youtubeId: string;
  title: string;
  position: number;
  error: string;
}

export interface PlaylistImportResult {
  folder: { id: string; name: string };
  videos: Array<{
    id: string;
    videoSummaryId: string;
    youtubeId: string;
    title: string | null;
    status: string;
    position: number;
  }>;
  totalVideos: number;
  cachedCount: number;
  processingCount: number;
  failedCount: number;
  failedVideos: FailedVideoImport[];
}

const EXTRACT_TIMEOUT_MS = 30000; // 30 seconds for extraction

export class PlaylistService {
  private videoService: VideoService;

  constructor(private db: Db) {
    this.videoService = new VideoService(db);
  }

  /**
   * Preview a playlist before importing.
   * Extracts metadata and checks cache status for each video.
   */
  async preview(url: string, maxVideos = 100): Promise<PlaylistPreview> {
    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      throw new InvalidPlaylistUrlError();
    }

    // Call summarizer to extract playlist data
    const playlistData = await this.extractFromSummarizer(playlistId, maxVideos);

    // Check cache status for each video
    const videoIds = playlistData.videos.map(v => v.video_id);
    const cachedVideos = await this.getCachedVideoIds(videoIds);

    const videos: PlaylistVideo[] = playlistData.videos.map(v => ({
      videoId: v.video_id,
      title: v.title,
      position: v.position,
      duration: v.duration,
      thumbnailUrl: v.thumbnail_url,
      isCached: cachedVideos.has(v.video_id),
    }));

    const cachedCount = videos.filter(v => v.isCached).length;

    return {
      playlistId: playlistData.playlist_id,
      title: playlistData.title,
      channel: playlistData.channel,
      thumbnailUrl: playlistData.thumbnail_url,
      totalVideos: playlistData.total_videos,
      videos,
      cachedCount,
    };
  }

  /**
   * Import a playlist, creating videos for each entry.
   * Creates a folder with the playlist name if folderId not provided.
   */
  async import(
    userId: string,
    url: string,
    folderId?: string,
    maxVideos = 100,
    providers?: ProviderConfig
  ): Promise<PlaylistImportResult> {
    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      throw new InvalidPlaylistUrlError();
    }

    // Extract playlist data
    const playlistData = await this.extractFromSummarizer(playlistId, maxVideos);

    // Create folder if not provided
    let folder: { id: string; name: string };
    if (folderId) {
      // Use existing folder
      const existingFolder = await this.db.collection('folders').findOne({
        _id: new ObjectId(folderId),
        userId: new ObjectId(userId),
      });
      if (!existingFolder) {
        throw new FolderNotFoundError();
      }
      folder = { id: existingFolder._id.toString(), name: existingFolder.name };
    } else {
      // Create new folder with playlist name
      const folderName = this.sanitizeFolderName(playlistData.title);
      const newFolder = await createFolder(this.db, {
        userId,
        name: folderName,
        type: 'summarized',
      });
      folder = { id: newFolder.id, name: newFolder.name };
    }

    // Process each video
    const results: PlaylistImportResult['videos'] = [];
    const failedVideos: FailedVideoImport[] = [];
    let cachedCount = 0;
    let processingCount = 0;

    for (const video of playlistData.videos) {
      try {
        const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;

        // Create playlistInfo for this video
        const playlistInfo: PlaylistInfo = {
          playlistId: playlistData.playlist_id,
          playlistTitle: playlistData.title,
          position: video.position,
          totalVideos: playlistData.total_videos,
        };

        // Create video with playlist info
        const result = await this.createVideoWithPlaylistInfo(
          userId,
          videoUrl,
          folder.id,
          playlistInfo,
          providers
        );

        results.push({
          id: result.video.id,
          videoSummaryId: result.video.videoSummaryId,
          youtubeId: video.video_id,
          title: result.video.title ?? video.title,
          status: result.video.status,
          position: video.position,
        });

        if (result.cached) {
          cachedCount++;
        } else {
          processingCount++;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.warn(`Failed to import video ${video.video_id}: ${errorMessage}`);
        failedVideos.push({
          youtubeId: video.video_id,
          title: video.title,
          position: video.position,
          error: errorMessage,
        });
      }
    }

    return {
      folder,
      videos: results,
      totalVideos: playlistData.total_videos,
      cachedCount,
      processingCount,
      failedCount: failedVideos.length,
      failedVideos,
    };
  }

  /**
   * Get all videos in a playlist for a user, sorted by position.
   */
  async getPlaylistVideos(userId: string, playlistId: string) {
    const videos = await this.db.collection('userVideos')
      .find({
        userId: new ObjectId(userId),
        'playlistInfo.playlistId': playlistId,
      })
      .sort({ 'playlistInfo.position': 1 })
      .toArray();

    return videos.map(v => ({
      id: v._id.toString(),
      videoSummaryId: v.videoSummaryId.toString(),
      youtubeId: v.youtubeId,
      title: v.title,
      channel: v.channel,
      duration: v.duration,
      thumbnailUrl: v.thumbnailUrl,
      status: v.status,
      folderId: v.folderId?.toString() || null,
      playlistInfo: v.playlistInfo,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  /**
   * Create a video with playlist info attached.
   */
  private async createVideoWithPlaylistInfo(
    userId: string,
    url: string,
    folderId: string,
    playlistInfo: PlaylistInfo,
    providers?: ProviderConfig
  ) {
    // First, create the video using existing video service
    const result = await this.videoService.createVideo(userId, url, folderId, false, providers);

    // Then update with playlist info
    await this.db.collection('userVideos').updateOne(
      { _id: new ObjectId(result.video.id) },
      { $set: { playlistInfo, updatedAt: new Date() } }
    );

    return result;
  }

  /**
   * Extract playlist data from summarizer service.
   */
  private async extractFromSummarizer(playlistId: string, maxVideos: number): Promise<SummarizerPlaylistResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);

    try {
      const response = await fetch(`${config.SUMMARIZER_URL}/playlist/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlist_id: playlistId,
          max_videos: maxVideos,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new PlaylistNotFoundError();
        }
        const error = await response.text();
        throw new PlaylistExtractionError(`Summarizer error: ${error}`);
      }

      return await response.json() as SummarizerPlaylistResponse;
    } catch (err) {
      if (err instanceof InvalidPlaylistUrlError ||
          err instanceof PlaylistNotFoundError ||
          err instanceof PlaylistExtractionError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PlaylistExtractionError('Playlist extraction timed out');
      }
      throw new PlaylistExtractionError(`Failed to extract playlist: ${err}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check which video IDs are already cached (completed).
   */
  private async getCachedVideoIds(videoIds: string[]): Promise<Set<string>> {
    const cached = await this.db.collection('videoSummaryCache')
      .find({
        youtubeId: { $in: videoIds },
        isLatest: true,
        status: 'completed',
      })
      .project({ youtubeId: 1 })
      .toArray();

    return new Set(cached.map(c => c.youtubeId));
  }

  /**
   * Sanitize playlist title for use as folder name.
   */
  private sanitizeFolderName(title: string): string {
    // Remove invalid characters, limit length
    return title
      .replace(/[/\\?%*:|"<>]/g, '')
      .trim()
      .substring(0, 100) || 'Playlist';
  }
}
