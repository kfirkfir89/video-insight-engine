import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Vitest globalSetup — runs ONCE in a single process before any test file.
 *
 * Why this exists: each test file's `beforeAll` calls `MongoMemoryServer.create()`
 * in its own vitest worker. On a cold CI runner the MongoDB binary isn't
 * cached, so multiple workers concurrently try to download to the same
 * lockfile and race — one of them ends up unlocking a file it doesn't own
 * (`UnableToUnlockLockfileError`) or trying to rename a `*.downloading` file
 * that another worker has already moved (`ENOENT`).
 *
 * Pre-downloading here serializes the binary fetch into a single process.
 * After this returns, every per-file `MongoMemoryServer.create()` finds the
 * binary in `~/.cache/mongodb-binaries/` and skips the download entirely.
 */
export default async function globalSetup(): Promise<void> {
  const mongod = await MongoMemoryServer.create();
  await mongod.stop();
}
