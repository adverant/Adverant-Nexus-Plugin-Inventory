import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { config } from './config/config';
import { inventoryItemRoutes } from './routes/inventory-item.routes';
import { inventoryLevelRoutes } from './routes/inventory-level.routes';
import { transactionRoutes } from './routes/transaction.routes';
import { stagingRoutes } from './routes/staging.routes';
import { healthRoutes } from './routes/health.routes';
import { usageTrackingOnRequest, usageTrackingOnResponse, flushPendingReports } from './middleware/usage-tracking';

const prisma = new PrismaClient({
  log: config.isDevelopment ? ['query', 'error', 'warn'] : ['error', 'warn'],
});

const server = Fastify({
  logger: {
    level: config.logLevel,
    transport: config.isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
});

// Register plugins
server.register(cors, {
  origin: config.corsOrigins,
  credentials: true,
});

server.register(helmet, {
  contentSecurityPolicy: config.isDevelopment ? false : undefined,
});

server.register(jwt, {
  secret: config.jwtSecret,
});

server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Usage tracking hooks (after body parsing)
server.addHook('onRequest', usageTrackingOnRequest);
server.addHook('onResponse', usageTrackingOnResponse);

// Decorate fastify with prisma instance
server.decorate('prisma', prisma);

// Health check routes
server.register(healthRoutes, { prefix: '/health' });

// API routes
server.register(inventoryItemRoutes, { prefix: '/api/v1/items' });
server.register(inventoryLevelRoutes, { prefix: '/api/v1/levels' });
server.register(transactionRoutes, { prefix: '/api/v1/transactions' });
server.register(stagingRoutes, { prefix: '/api/v1/staging' });

// Root endpoint
server.get('/', async (request, reply) => {
  return {
    service: 'Nexus Inventory Management Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      items: '/api/v1/items',
      levels: '/api/v1/levels',
      transactions: '/api/v1/transactions',
      staging: '/api/v1/staging',
    },
  };
});

// Graceful shutdown
const gracefulShutdown = async () => {
  server.log.info('Received shutdown signal, closing connections...');
  await flushPendingReports();
  await prisma.$disconnect();
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  server.log.error({ error }, 'Uncaught exception');
  gracefulShutdown();
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  server.log.error({ reason, promise }, 'Unhandled rejection');
});

// Start server
const start = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    server.log.info('Database connected successfully');

    await server.listen({
      port: config.port,
      host: config.host,
    });

    server.log.info(
      `🚀 Inventory Management Service running on http://${config.host}:${config.port}`
    );
    server.log.info(`📊 Environment: ${config.isDevelopment ? 'development' : 'production'}`);
    server.log.info(`📦 Prisma connected to: ${config.databaseUrl.split('@')[1]}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

// Type declaration for FastifyInstance with prisma
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
