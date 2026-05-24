import { Db } from 'mongodb';
import { FastifyBaseLogger } from 'fastify';

// Repositories
import { VideoRepository } from './repositories/video.repository.js';
import { FolderRepository } from './repositories/folder.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { ShareRepository } from './repositories/share.repository.js';
import { UserCostRepository } from './repositories/user-cost.repository.js';
import { IdempotencyRepository } from './repositories/idempotency.repository.js';
import { UserDeletionRepository } from './repositories/user-deletion.repository.js';

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
import { QueuePublisher, type ChannelSupplier } from './services/queue-publisher.service.js';
import { IdempotencyService } from './services/idempotency.service.js';
import { UserDeletionService } from './services/user-deletion.service.js';

export interface Container {
  // Repositories
  videoRepository: VideoRepository;
  folderRepository: FolderRepository;
  userRepository: UserRepository;
  shareRepository: ShareRepository;
  userCostRepository: UserCostRepository;
  idempotencyRepository: IdempotencyRepository;
  userDeletionRepository: UserDeletionRepository;

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
  queuePublisher: QueuePublisher;
  idempotencyService: IdempotencyService;
  userDeletionService: UserDeletionService;
}

export interface CreateContainerOptions {
  /** Supplier for a confirm channel — wired up by the rabbitmq plugin. */
  queueChannelSupplier?: ChannelSupplier;
}

export function createContainer(
  db: Db,
  logger: FastifyBaseLogger,
  options: CreateContainerOptions = {},
): Container {
  // Create repositories
  const videoRepository = new VideoRepository(db);
  const folderRepository = new FolderRepository(db);
  const userRepository = new UserRepository(db);
  const shareRepository = new ShareRepository(db);
  const userCostRepository = new UserCostRepository(db);
  const idempotencyRepository = new IdempotencyRepository(db);
  const userDeletionRepository = new UserDeletionRepository(db);

  // Create external clients
  const summarizerClient = new SummarizerClient(logger);
  const assistantClient = new AssistantClient(logger);

  // Queue publisher — falls back to a stub supplier in tests / pre-plugin paths.
  // The video service decides per-request whether to use HTTP or queue, so the
  // stub is fine when USE_QUEUE_PIPELINE=false.
  const channelSupplier: ChannelSupplier =
    options.queueChannelSupplier ??
    (() => {
      throw new Error('RabbitMQ channel supplier not configured');
    });
  const queuePublisher = new QueuePublisher(channelSupplier, logger);

  // Create services with injected dependencies
  const authService = new AuthService(userRepository, logger);
  const videoService = new VideoService(videoRepository, summarizerClient, queuePublisher, logger);
  const folderService = new FolderService(folderRepository, logger);
  const costMonitorService = new CostMonitorService(db, logger, userCostRepository);
  const playlistService = new PlaylistService(videoService, folderService, summarizerClient, logger, costMonitorService);
  const shareService = new ShareService(shareRepository, videoRepository, logger);
  const ogImageService = new OgImageService(logger);
  const paymentService = new PaymentService(userRepository, videoRepository, logger);
  const idempotencyService = new IdempotencyService(idempotencyRepository, logger);
  const userDeletionService = new UserDeletionService(
    db,
    userRepository,
    userDeletionRepository,
    logger,
  );

  return {
    // Repositories
    videoRepository,
    folderRepository,
    userRepository,
    shareRepository,
    userCostRepository,
    idempotencyRepository,
    userDeletionRepository,

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
    queuePublisher,
    idempotencyService,
    userDeletionService,
  };
}

// Type declaration for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    container: Container;
  }
}
