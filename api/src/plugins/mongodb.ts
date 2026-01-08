import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: {
      client: MongoClient;
      db: Db;
    };
  }
}

async function mongodb(fastify: FastifyInstance) {
  const client = new MongoClient(config.MONGODB_URI);
  await client.connect();

  const db = client.db();

  fastify.decorate('mongo', { client, db });

  fastify.addHook('onClose', async () => {
    await client.close();
  });

  fastify.log.info('MongoDB connected');
}

export const mongodbPlugin = fp(mongodb);
