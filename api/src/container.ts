import { Db } from 'mongodb';
import { FastifyBaseLogger } from 'fastify';

// Repositories
import { VideoRepository } from './repositories/video.repository.js';
import { FolderRepository } from './repositories/folder.repository.js';
import { MemorizeRepository } from './repositories/memorize.repository.js';
import { UserRepository } from './repositories/user.repository.js';

// Services
import { AuthService } from './services/auth.service.js';
import { VideoService } from './services/video.service.js';
import { FolderService } from './services/folder.service.js';
import { MemorizeService } from './services/memorize.service.js';
import { PlaylistService } from './services/playlist.service.js';
import { SummarizerClient } from './services/summarizer-client.js';
import { ExplainerClient } from './services/explainer-client.js';

export interface Container {
  // Repositories
  videoRepository: VideoRepository;
  folderRepository: FolderRepository;
  memorizeRepository: MemorizeRepository;
  userRepository: UserRepository;

  // Services
  authService: AuthService;
  videoService: VideoService;
  folderService: FolderService;
  memorizeService: MemorizeService;
  playlistService: PlaylistService;
  summarizerClient: SummarizerClient;
  explainerClient: ExplainerClient;
}

export function createContainer(db: Db, logger: FastifyBaseLogger): Container {
  // Create repositories
  const videoRepository = new VideoRepository(db);
  const folderRepository = new FolderRepository(db);
  const memorizeRepository = new MemorizeRepository(db);
  const userRepository = new UserRepository(db);

  // Create external clients
  const summarizerClient = new SummarizerClient(logger);
  const explainerClient = new ExplainerClient(logger);

  // Create services with injected dependencies
  const authService = new AuthService(userRepository, logger);
  const videoService = new VideoService(videoRepository, summarizerClient, logger);
  const folderService = new FolderService(folderRepository, logger);
  const memorizeService = new MemorizeService(memorizeRepository, videoRepository, logger);
  const playlistService = new PlaylistService(videoService, folderService, summarizerClient, logger);

  return {
    // Repositories
    videoRepository,
    folderRepository,
    memorizeRepository,
    userRepository,

    // Services
    authService,
    videoService,
    folderService,
    memorizeService,
    playlistService,
    summarizerClient,
    explainerClient,
  };
}

// Type declaration for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    container: Container;
  }
}
