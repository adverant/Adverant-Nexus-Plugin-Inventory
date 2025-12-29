import { FastifyInstance } from 'fastify';
import { TransactionController } from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth.middleware';

export async function transactionRoutes(server: FastifyInstance) {
  const controller = new TransactionController(server);

  // List transactions
  server.get(
    '/',
    {
      preHandler: [authenticate],
    },
    controller.listTransactions.bind(controller)
  );

  // Get transaction by ID
  server.get(
    '/:id',
    {
      preHandler: [authenticate],
    },
    controller.getTransaction.bind(controller)
  );

  // Get transaction history for item
  server.get(
    '/item/:itemId/history',
    {
      preHandler: [authenticate],
    },
    controller.getItemHistory.bind(controller)
  );

  // Get transaction statistics
  server.get(
    '/analytics/statistics',
    {
      preHandler: [authenticate],
    },
    controller.getStatistics.bind(controller)
  );

  // Create transaction
  server.post(
    '/',
    {
      preHandler: [authenticate],
    },
    controller.createTransaction.bind(controller)
  );

  // Transfer inventory
  server.post(
    '/transfer',
    {
      preHandler: [authenticate],
    },
    controller.transferInventory.bind(controller)
  );

  // Approve transaction
  server.post(
    '/:id/approve',
    {
      preHandler: [authenticate],
    },
    controller.approveTransaction.bind(controller)
  );

  // Reject transaction
  server.post(
    '/:id/reject',
    {
      preHandler: [authenticate],
    },
    controller.rejectTransaction.bind(controller)
  );

  // Process transaction
  server.post(
    '/:id/process',
    {
      preHandler: [authenticate],
    },
    controller.processTransaction.bind(controller)
  );
}
