import { FastifyInstance } from 'fastify';
import { vi } from 'vitest';
import { buildApp } from '../app.js';

// Mock container services for route testing
export interface MockContainer {
  videoRepository: {
    userHasAccessToSummary: ReturnType<typeof vi.fn>;
    userOwnsVideo: ReturnType<typeof vi.fn>;
    findUserVideo: ReturnType<typeof vi.fn>;
    findCacheById: ReturnType<typeof vi.fn>;
    updateCacheEntry: ReturnType<typeof vi.fn>;
  };
  memorizeRepository: {
    findById: ReturnType<typeof vi.fn>;
  };
  videoService: {
    createVideo: ReturnType<typeof vi.fn>;
    getVideos: ReturnType<typeof vi.fn>;
    getVideo: ReturnType<typeof vi.fn>;
    deleteVideo: ReturnType<typeof vi.fn>;
    moveToFolder: ReturnType<typeof vi.fn>;
    userOwnsVideo: ReturnType<typeof vi.fn>;
    getVersions: ReturnType<typeof vi.fn>;
    overrideCategory: ReturnType<typeof vi.fn>;
    persistTriageResult: ReturnType<typeof vi.fn>;
  };
  folderService: {
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  authService: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
  };
  memorizeService: {
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    listChats: ReturnType<typeof vi.fn>;
  };
  playlistService: {
    preview: ReturnType<typeof vi.fn>;
    import: ReturnType<typeof vi.fn>;
    getPlaylistVideos: ReturnType<typeof vi.fn>;
  };
  explainerClient: {
    explainAuto: ReturnType<typeof vi.fn>;
    videoChat: ReturnType<typeof vi.fn>;
  };
  summarizerClient: {
    triggerSummarization: ReturnType<typeof vi.fn>;
  };
  shareService: {
    createShare: ReturnType<typeof vi.fn>;
    getPublicSummary: ReturnType<typeof vi.fn>;
    likeShare: ReturnType<typeof vi.fn>;
  };
  ogImageService: {
    getOgImage: ReturnType<typeof vi.fn>;
  };
  paymentService: {
    verifyWebhook: ReturnType<typeof vi.fn>;
    handleWebhookEvent: ReturnType<typeof vi.fn>;
    generateCheckoutUrl: ReturnType<typeof vi.fn>;
    getUserTier: ReturnType<typeof vi.fn>;
  };
  costMonitorService: {
    isDailyLimitExceeded: ReturnType<typeof vi.fn>;
    getDailySpend: ReturnType<typeof vi.fn>;
    getRecommendedModel: ReturnType<typeof vi.fn>;
    recordUsage: ReturnType<typeof vi.fn>;
  };
  shareRepository: {
    findBySlug: ReturnType<typeof vi.fn>;
    markAsShared: ReturnType<typeof vi.fn>;
    incrementViews: ReturnType<typeof vi.fn>;
    hasLiked: ReturnType<typeof vi.fn>;
    addLike: ReturnType<typeof vi.fn>;
    getShareInfo: ReturnType<typeof vi.fn>;
  };
}

export function createMockContainer(): MockContainer {
  return {
    videoRepository: {
      userHasAccessToSummary: vi.fn().mockResolvedValue(true),
      userOwnsVideo: vi.fn().mockResolvedValue(true),
      findUserVideo: vi.fn(),
      findCacheById: vi.fn(),
      updateCacheEntry: vi.fn(),
    },
    memorizeRepository: {
      findById: vi.fn().mockResolvedValue({ id: 'item123', userId: 'test-user-id' }),
    },
    videoService: {
      createVideo: vi.fn(),
      getVideos: vi.fn(),
      getVideo: vi.fn(),
      deleteVideo: vi.fn(),
      moveToFolder: vi.fn(),
      userOwnsVideo: vi.fn(),
      getVersions: vi.fn(),
      overrideCategory: vi.fn(),
      persistTriageResult: vi.fn(),
    },
    folderService: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    authService: {
      register: vi.fn(),
      login: vi.fn(),
      getUser: vi.fn(),
    },
    memorizeService: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      listChats: vi.fn(),
    },
    playlistService: {
      preview: vi.fn(),
      import: vi.fn(),
      getPlaylistVideos: vi.fn(),
    },
    explainerClient: {
      explainAuto: vi.fn(),
      videoChat: vi.fn(),
    },
    summarizerClient: {
      triggerSummarization: vi.fn(),
    },
    shareService: {
      createShare: vi.fn(),
      getPublicSummary: vi.fn(),
      likeShare: vi.fn(),
    },
    ogImageService: {
      getOgImage: vi.fn(),
    },
    paymentService: {
      verifyWebhook: vi.fn().mockReturnValue(true),
      handleWebhookEvent: vi.fn(),
      generateCheckoutUrl: vi.fn(),
      getUserTier: vi.fn().mockResolvedValue({ tier: 'free', limits: { videosPerDay: 3, chatPerOutput: 5, shareEnabled: true, exportEnabled: false } }),
    },
    costMonitorService: {
      isDailyLimitExceeded: vi.fn().mockResolvedValue(false),
      getDailySpend: vi.fn().mockResolvedValue({ total: 0, limit: 50, percentage: 0 }),
      getRecommendedModel: vi.fn().mockResolvedValue('sonnet'),
      recordUsage: vi.fn(),
    },
    shareRepository: {
      findBySlug: vi.fn(),
      markAsShared: vi.fn(),
      incrementViews: vi.fn(),
      hasLiked: vi.fn().mockResolvedValue(false),
      addLike: vi.fn().mockResolvedValue(1),
      getShareInfo: vi.fn(),
    },
  };
}

// Test user for authenticated requests
export const testUser = {
  userId: 'test-user-id',
  email: 'test@example.com',
};

// Generate a valid JWT for testing
export async function getAuthHeader(app: FastifyInstance): Promise<string> {
  const token = app.jwt.sign({ userId: testUser.userId, email: testUser.email });
  return `Bearer ${token}`;
}

// Build app with mock container for testing
export async function buildTestApp(mockContainer?: Partial<MockContainer>): Promise<FastifyInstance> {
  const app = await buildApp({
    logger: false,
    // Pass container overrides to buildApp for proper injection
    container: mockContainer as Partial<typeof app.container>,
  });

  return app;
}
