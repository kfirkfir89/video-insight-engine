import { Db } from 'mongodb';
import { FastifyBaseLogger } from 'fastify';

// Repositories
import { VideoRepository } from './repositories/video.repository.js';
import { FolderRepository } from './repositories/folder.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { ShareRepository } from './repositories/share.repository.js';

// Services
import { AuthService } from './services/auth.service.js';
import { VideoService } from './services/video.service.js';
import { FolderService } from './services/folder.service.js';
import { PlaylistService } from './services/playlist.service.js';
import { SummarizerClient } from './services/summarizer-client.js';
import { AssistantClient } from './services/assistant-client.js';
import { ShareService } from './services/share.service.js';
import { OgImageService } from './services/og-image.service.js';
import { PaymentService } from './services/payment.service.js';
import { CostMonitorService } from './services/cost-monitor.service.js';

export interface Container {
  // Repositories
  videoRepository: VideoRepository;
  folderRepository: FolderRepository;
  userRepository: UserRepository;
  shareRepository: ShareRepository;

  // Services
  authService: AuthService;
  videoService: VideoService;
  folderService: FolderService;
  playlistService: PlaylistService;
  summarizerClient: SummarizerClient;
  assistantClient: AssistantClient;
  shareService: ShareService;
  ogImageService: OgImageService;
  paymentService: PaymentService;
  costMonitorService: CostMonitorService;
}

export function createContainer(db: Db, logger: FastifyBaseLogger): Container {
  // Create repositories
  const videoRepository = new VideoRepository(db);
  const folderRepository = new FolderRepository(db);
  const userRepository = new UserRepository(db);
  const shareRepository = new ShareRepository(db);

  // Create external clients
  const summarizerClient = new SummarizerClient(logger);
  const assistantClient = new AssistantClient(logger);

  // Create services with injected dependencies
  const authService = new AuthService(userRepository, logger);
  const videoService = new VideoService(videoRepository, summarizerClient, logger);
  const folderService = new FolderService(folderRepository, logger);
  const playlistService = new PlaylistService(videoService, folderService, summarizerClient, logger);
  const shareService = new ShareService(shareRepository, videoRepository, logger);
  const ogImageService = new OgImageService(logger);
  const paymentService = new PaymentService(userRepository, videoRepository, logger);
  const costMonitorService = new CostMonitorService(db, logger);

  return {
    // Repositories
    videoRepository,
    folderRepository,
    userRepository,
    shareRepository,

    // Services
    authService,
    videoService,
    folderService,
    playlistService,
    summarizerClient,
    assistantClient,
    shareService,
    ogImageService,
    paymentService,
    costMonitorService,
  };
}

// Type declaration for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    container: Container;
  }
}
