import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string(),
  SUMMARIZER_URL: z.string().default('http://vie-summarizer:8000'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  // Additional CORS origins (comma-separated, optional)
  // Combined with FRONTEND_URL to form the full list of allowed origins
  CORS_ADDITIONAL_ORIGINS: z.string().default(''),
  // Assistant service URL (HTTP API + SSE)
  ASSISTANT_URL: z.string().default('http://vie-assistant:8001'),
  // Shared secret for internal service-to-service auth
  INTERNAL_SECRET: z.string().min(16).default('dev-internal-secret-change-me'),
  // Configurable rate limits
  RATE_LIMIT_MAX: z.string().default('300').transform(Number),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  // Playlist-specific rate limits (higher in test mode to avoid test interference)
  PLAYLIST_PREVIEW_RATE_LIMIT: z.string().default('30').transform(Number),
  PLAYLIST_IMPORT_RATE_LIMIT: z.string().default('5').transform(Number),
  // Video creation daily limit (0 = unlimited for admins/dev)
  VIDEO_DAILY_LIMIT: z.string().default('100').transform(Number),
  // Payment (Paddle)
  PADDLE_WEBHOOK_SECRET: z.string().default(''),
  PADDLE_PRO_PRICE_ID: z.string().default(''),
  PADDLE_TEAM_PRICE_ID: z.string().default(''),
  // Cost monitoring
  COST_DAILY_LIMIT: z.string().default('50').transform(Number),
  COST_ALERT_SLACK_WEBHOOK: z.string().optional(),
  // Per-user daily cost limits in USD (0 disables the limit; -1 means unlimited)
  USER_COST_LIMIT_FREE: z.string().default('2').transform(Number),
  USER_COST_LIMIT_PRO: z.string().default('20').transform(Number),
  USER_COST_LIMIT_TEAM: z.string().default('-1').transform(Number),
  // Analytics (PostHog)
  POSTHOG_API_KEY: z.string().optional(),
  // ─── RabbitMQ job queue ─────────────────────────────────────────────
  // amqplib connection URL. The credentials are supplied via docker-compose env
  // (RABBITMQ_DEFAULT_USER / PASS) so this default works in the dev compose.
  RABBITMQ_URL: z.string().default('amqp://vie:vie-dev@vie-rabbitmq:5672/'),
  // Publisher confirms are always enabled; this caps the unacknowledged outflight
  // window. Conservative because the API publishes one message per request.
  RABBITMQ_PUBLISH_TIMEOUT_MS: z.string().default('5000').transform(Number),
  // Flip ON to route POST /api/videos through RabbitMQ. Behind a flag so shadow
  // testing and quick rollback are both one env-var away.
  USE_QUEUE_PIPELINE: z.string().default('false').transform(v => v === 'true'),
  // Admin endpoints for /api/admin/queue/* and DLQ replay. Different from
  // INTERNAL_SECRET so a leaked admin key cannot impersonate the summarizer.
  ADMIN_API_KEY: z.string().min(8).default('dev-admin-key-change-me'),
  // ─── Idempotency ────────────────────────────────────────────────────
  // Canonical pipeline version string baked into idempotency hashes. Bump
  // this when prompts, schemas, or any other pipeline output-shaping logic
  // changes — every stale key auto-misses on the next submit.
  PIPELINE_VERSION: z.string().min(1).default('v1'),
  // TTL window for an idempotency hit. 24h is long enough for accidental
  // double-submits and short enough that "I want to retry tomorrow" still works.
  IDEMPOTENCY_TTL_SECONDS: z.string().default('86400').transform(Number),
  // ─── Sentry ─────────────────────────────────────────────────────────
  // Empty DSN disables the SDK entirely — the init helper no-ops and the
  // plugin's hooks become cheap pass-throughs. Lets dev/CI run without
  // provisioning a project.
  SENTRY_DSN: z.string().default(''),
  SENTRY_ENVIRONMENT: z.string().optional(),
  // Set by CI to the deploy SHA so events are linkable to releases.
  SENTRY_RELEASE: z.string().optional(),
  // 0 → performance tracing off (errors still captured). 0.1 in prod is a
  // good starting point; 1.0 in dev to see every transaction while iterating.
  SENTRY_TRACES_SAMPLE_RATE: z.string().default('0').transform(Number),
});

const parsedConfig = envSchema.parse(process.env);

// Validate URL format
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Build allowed origins list from FRONTEND_URL and any additional origins
function buildAllowedOrigins(): string[] {
  const origins = new Set<string>();

  // Always include FRONTEND_URL
  origins.add(parsedConfig.FRONTEND_URL);

  // In development, always allow localhost:5173
  if (parsedConfig.NODE_ENV === 'development') {
    origins.add('http://localhost:5173');
  }

  // Add any additional origins from env (with validation)
  if (parsedConfig.CORS_ADDITIONAL_ORIGINS) {
    const additionalOrigins = parsedConfig.CORS_ADDITIONAL_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(Boolean);

    for (const origin of additionalOrigins) {
      if (!isValidUrl(origin)) {
        throw new Error(`Invalid CORS origin URL: ${origin}`);
      }
      origins.add(origin);
    }
  }

  return Array.from(origins);
}

// Test mode rate limit multiplier to avoid test interference
const TEST_RATE_LIMIT_MULTIPLIER = 20;

export const config = {
  ...parsedConfig,
  // Computed property: list of all allowed CORS origins
  ALLOWED_ORIGINS: buildAllowedOrigins(),
  // Computed rate limits - higher in test mode to avoid interference
  RATE_LIMITS: {
    PLAYLIST_PREVIEW: parsedConfig.NODE_ENV === 'test'
      ? parsedConfig.PLAYLIST_PREVIEW_RATE_LIMIT * TEST_RATE_LIMIT_MULTIPLIER
      : parsedConfig.PLAYLIST_PREVIEW_RATE_LIMIT,
    PLAYLIST_IMPORT: parsedConfig.NODE_ENV === 'test'
      ? parsedConfig.PLAYLIST_IMPORT_RATE_LIMIT * TEST_RATE_LIMIT_MULTIPLIER
      : parsedConfig.PLAYLIST_IMPORT_RATE_LIMIT,
    // Video daily limit (0 = unlimited, useful for dev/admin)
    VIDEO_DAILY: parsedConfig.NODE_ENV === 'test'
      ? parsedConfig.VIDEO_DAILY_LIMIT * TEST_RATE_LIMIT_MULTIPLIER
      : parsedConfig.VIDEO_DAILY_LIMIT,
  },
  // Per-user daily LLM cost limits in USD by tier.
  //   -1 → unlimited (admin/team)
  //    0 → disabled (treated as unlimited)
  //   > 0 → enforced hard ceiling at UTC midnight reset
  COST_LIMITS_PER_TIER: {
    free: parsedConfig.USER_COST_LIMIT_FREE,
    pro: parsedConfig.USER_COST_LIMIT_PRO,
    team: parsedConfig.USER_COST_LIMIT_TEAM,
  } as Record<'free' | 'pro' | 'team', number>,
};
