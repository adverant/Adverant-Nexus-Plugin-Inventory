import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function healthRoutes(server: FastifyInstance) {
  server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check database connection
      await server.prisma.$queryRaw`SELECT 1`;

      return reply.send({
        status: 'healthy',
        service: 'nexus-inventory',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
      });
    } catch (error) {
      return reply.code(503).send({
        status: 'unhealthy',
        service: 'nexus-inventory',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  server.get('/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await server.prisma.$queryRaw`SELECT 1`;

      return reply.send({
        status: 'ready',
        service: 'nexus-inventory',
      });
    } catch (error) {
      return reply.code(503).send({
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  server.get('/live', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'alive',
      service: 'nexus-inventory',
    });
  });
}
