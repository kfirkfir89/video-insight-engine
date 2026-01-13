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
  // Explainer service URL (HTTP API)
  EXPLAINER_URL: z.string().default('http://vie-explainer:8001'),
  // Shared secret for internal service-to-service auth
  INTERNAL_SECRET: z.string().min(16).default('dev-internal-secret-change-me'),
  // Configurable rate limits
  RATE_LIMIT_MAX: z.string().default('300').transform(Number),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
});

const parsedConfig = envSchema.parse(process.env);

// Build allowed origins list from FRONTEND_URL and any additional origins
function buildAllowedOrigins(): string[] {
  const origins = new Set<string>();

  // Always include FRONTEND_URL
  origins.add(parsedConfig.FRONTEND_URL);

  // In development, always allow localhost:5173
  if (parsedConfig.NODE_ENV === 'development') {
    origins.add('http://localhost:5173');
  }

  // Add any additional origins from env
  if (parsedConfig.CORS_ADDITIONAL_ORIGINS) {
    parsedConfig.CORS_ADDITIONAL_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
      .forEach(origin => origins.add(origin));
  }

  return Array.from(origins);
}

export const config = {
  ...parsedConfig,
  // Computed property: list of all allowed CORS origins
  ALLOWED_ORIGINS: buildAllowedOrigins(),
};
