// Set required environment variables for tests BEFORE any imports that use config
// This file runs first in setupFiles to ensure config validation passes
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.SUMMARIZER_URL = 'http://localhost:8000';
process.env.EXPLAINER_URL = 'http://localhost:8001';
