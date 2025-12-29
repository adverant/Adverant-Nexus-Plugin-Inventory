import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TransactionService } from '../services/transaction.service';
import {
  CreateTransactionDTO,
  ApproveTransactionDTO,
  RejectTransactionDTO,
  TransferInventoryDTO,
  ListTransactionsQuery,
} from '../types';

export class TransactionController {
  private transactionService: TransactionService;

  constructor(private server: FastifyInstance) {
    this.transactionService = new TransactionService(server.prisma);
  }

  async listTransactions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as ListTransactionsQuery;
      const result = await this.transactionService.listTransactions(query);
      return reply.send(result);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const transaction = await this.transactionService.getTransaction(id);

      if (!transaction) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Transaction not found',
        });
      }

      return reply.send(transaction);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const data = request.body as CreateTransactionDTO;

      const transaction = await this.transactionService.createTransaction({
        ...data,
        createdBy: user?.userId,
      });

      return reply.code(201).send(transaction);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async approveTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const data = request.body as Partial<ApproveTransactionDTO>;

      const transaction = await this.transactionService.approveTransaction(id, {
        approvedBy: user?.userId || 'system',
        notes: data.notes,
      });

      return reply.send(transaction);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('not pending')) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async rejectTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const { rejectionReason } = request.body as { rejectionReason: string };

      if (!rejectionReason) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Rejection reason is required',
        });
      }

      const transaction = await this.transactionService.rejectTransaction(id, {
        rejectionReason,
        rejectedBy: user?.userId || 'system',
      });

      return reply.send(transaction);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('not pending')) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async processTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      await this.transactionService.processTransaction(id);

      return reply.send({ success: true, message: 'Transaction processed successfully' });
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        (error.message.includes('already completed') ||
          error.message.includes('must be approved'))
      ) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async transferInventory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const data = request.body as TransferInventoryDTO;

      const transaction = await this.transactionService.transferInventory({
        ...data,
        createdBy: user?.userId,
      });

      return reply.code(201).send(transaction);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('Insufficient')) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getItemHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { itemId } = request.params as { itemId: string };
      const { limit } = request.query as { limit?: string };

      const transactions = await this.transactionService.getItemTransactionHistory(
        itemId,
        limit ? parseInt(limit) : 50
      );

      return reply.send({ transactions });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getStatistics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const statistics = await this.transactionService.getTransactionStatistics(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      return reply.send(statistics);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
