/**
 * Create (or promote) an admin user for the vie-admin panel.
 *
 * Inserts into the shared `users` collection with `role: 'admin'`, matching
 * the document shape written by api/src/repositories/user.repository.ts.
 * If the email already exists, the password is reset and the user promoted.
 *
 * Usage (from api/ so deps resolve): npx tsx ../scripts/create-admin.ts <email> <password> [name]
 */

import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/video-insight-engine';

async function main(): Promise<void> {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> [name]');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const users = client.db().collection('users');
    const now = new Date();

    const result = await users.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          passwordHash,
          role: 'admin',
          updatedAt: now,
        },
        $setOnInsert: {
          email: normalizedEmail,
          name: name || 'Admin',
          preferences: { defaultSummarizedFolder: null, theme: 'system' },
          usage: { videosThisMonth: 0, videosResetAt: now },
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const action = result && result.createdAt < now ? 'promoted to admin' : 'created';
    console.log(`✅ ${normalizedEmail} ${action} (role: admin).`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
