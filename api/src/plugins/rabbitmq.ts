import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import amqplib, { ChannelModel, ConfirmChannel } from 'amqplib';
import { config } from '../config.js';
import { QUEUE_TOPOLOGY, queueArguments } from '../services/queue-topology.js';

declare module 'fastify' {
  interface FastifyInstance {
    rabbitmq: RabbitMQContext;
  }
}

export interface RabbitMQContext {
  /** Returns the current confirm channel, reconnecting if the connection dropped. */
  getChannel(): Promise<ConfirmChannel>;
  /** True once the topology has been asserted at least once this process. */
  isReady(): boolean;
}

interface ConnectionState {
  connection: ChannelModel | null;
  channel: ConfirmChannel | null;
  topologyAsserted: boolean;
}

async function assertTopology(channel: ConfirmChannel): Promise<void> {
  await channel.assertExchange(QUEUE_TOPOLOGY.exchange, 'direct', { durable: true });
  await channel.assertExchange(QUEUE_TOPOLOGY.dlx, 'direct', { durable: true });
  await channel.assertQueue(QUEUE_TOPOLOGY.dlq, { durable: true });
  await channel.bindQueue(
    QUEUE_TOPOLOGY.dlq,
    QUEUE_TOPOLOGY.dlx,
    QUEUE_TOPOLOGY.dlqRoutingKey,
  );
  await channel.assertQueue(QUEUE_TOPOLOGY.queue, {
    durable: true,
    arguments: queueArguments,
  });
  await channel.bindQueue(
    QUEUE_TOPOLOGY.queue,
    QUEUE_TOPOLOGY.exchange,
    QUEUE_TOPOLOGY.routingKey,
  );
}

async function rabbitmq(fastify: FastifyInstance): Promise<void> {
  const state: ConnectionState = {
    connection: null,
    channel: null,
    topologyAsserted: false,
  };

  async function connect(): Promise<ConfirmChannel> {
    fastify.log.info({ url: redactUrl(config.RABBITMQ_URL) }, 'Connecting to RabbitMQ');
    const connection = await amqplib.connect(config.RABBITMQ_URL);

    connection.on('error', (err) => {
      fastify.log.error({ err }, 'RabbitMQ connection error');
    });
    connection.on('close', () => {
      fastify.log.warn('RabbitMQ connection closed');
      state.connection = null;
      state.channel = null;
      state.topologyAsserted = false;
    });

    const channel = await connection.createConfirmChannel();
    channel.on('error', (err) => {
      fastify.log.error({ err }, 'RabbitMQ channel error');
    });
    channel.on('close', () => {
      fastify.log.warn('RabbitMQ channel closed');
      state.channel = null;
      state.topologyAsserted = false;
    });

    await assertTopology(channel);
    state.connection = connection;
    state.channel = channel;
    state.topologyAsserted = true;
    fastify.log.info('RabbitMQ topology asserted');
    return channel;
  }

  async function getChannel(): Promise<ConfirmChannel> {
    if (state.channel && state.topologyAsserted) {
      return state.channel;
    }
    return connect();
  }

  fastify.decorate('rabbitmq', {
    getChannel,
    isReady: () => state.topologyAsserted,
  });

  fastify.addHook('onReady', async () => {
    try {
      await connect();
    } catch (err) {
      // Don't crash the app — the publisher path surfaces a 503 on first publish
      // attempt instead. This keeps health checks green during transient broker
      // restarts and lets us inspect the API even when RabbitMQ is down.
      fastify.log.error({ err }, 'RabbitMQ initial connect failed; will retry on demand');
    }
  });

  fastify.addHook('onClose', async () => {
    if (state.channel) {
      try {
        await state.channel.close();
      } catch (err) {
        fastify.log.debug({ err }, 'RabbitMQ channel close error (ignored)');
      }
    }
    if (state.connection) {
      try {
        await state.connection.close();
      } catch (err) {
        fastify.log.debug({ err }, 'RabbitMQ connection close error (ignored)');
      }
    }
  });
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return 'amqp://(unparseable)';
  }
}

export const rabbitmqPlugin = fp(rabbitmq, { name: 'rabbitmq' });
