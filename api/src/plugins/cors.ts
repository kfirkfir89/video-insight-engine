import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { config } from '../config.js';

async function corsSetup(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: [config.FRONTEND_URL, 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}

export const corsPlugin = fp(corsSetup);
