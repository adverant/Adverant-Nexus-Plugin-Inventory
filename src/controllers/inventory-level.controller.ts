import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InventoryLevelService } from '../services/inventory-level.service';
import {
  CreateInventoryLevelDTO,
  UpdateInventoryLevelDTO,
  AdjustInventoryDTO,
  ListInventoryLevelsQuery,
} from '../types';

export class InventoryLevelController {
  private levelService: InventoryLevelService;

  constructor(private server: FastifyInstance) {
    this.levelService = new InventoryLevelService(server.prisma);
  }

  async listLevels(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as ListInventoryLevelsQuery;
      const result = await this.levelService.listLevels(query);
      return reply.send(result);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getLevel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const level = await this.levelService.getLevel(id);

      if (!level) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Inventory level not found',
        });
      }

      return reply.send(level);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getLevelByLocation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { itemId, propertyId, unitId, roomId } = request.query as {
        itemId: string;
        propertyId: string;
        unitId?: string;
        roomId?: string;
      };

      if (!itemId || !propertyId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'itemId and propertyId are required',
        });
      }

      const level = await this.levelService.getLevelByLocation(
        itemId,
        propertyId,
        unitId,
        roomId
      );

      if (!level) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Inventory level not found for this location',
        });
      }

      return reply.send(level);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createLevel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as CreateInventoryLevelDTO;
      const level = await this.levelService.createLevel(data);

      return reply.code(201).send(level);
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

  async updateLevel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateInventoryLevelDTO;

      const level = await this.levelService.updateLevel(id, data);

      return reply.send(level);
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

  async adjustInventory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const data = request.body as AdjustInventoryDTO;

      const level = await this.levelService.adjustInventory({
        ...data,
        createdBy: user?.userId,
      });

      return reply.send(level);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('Insufficient')) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        });
      }

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

  async reserveInventory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { itemId, propertyId, quantity, unitId, roomId } = request.body as {
        itemId: string;
        propertyId: string;
        quantity: number;
        unitId?: string;
        roomId?: string;
      };

      const level = await this.levelService.reserveInventory(
        itemId,
        propertyId,
        quantity,
        unitId,
        roomId
      );

      return reply.send(level);
    } catch (error) {
      this.server.log.error(error);

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

  async releaseReservedInventory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { itemId, propertyId, quantity, unitId, roomId } = request.body as {
        itemId: string;
        propertyId: string;
        quantity: number;
        unitId?: string;
        roomId?: string;
      };

      const level = await this.levelService.releaseReservedInventory(
        itemId,
        propertyId,
        quantity,
        unitId,
        roomId
      );

      return reply.send(level);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('Cannot release')) {
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

  async cycleCount(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const { levelId, countedQuantity, notes } = request.body as {
        levelId: string;
        countedQuantity: number;
        notes?: string;
      };

      const result = await this.levelService.cycleCount(
        levelId,
        countedQuantity,
        user?.userId || 'system',
        notes
      );

      return reply.send(result);
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

  async getLowStockAlerts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.query as { propertyId?: string };
      const alerts = await this.levelService.getLowStockAlerts(propertyId);

      return reply.send({ alerts });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getLevelsByProperty(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.params as { propertyId: string };
      const levels = await this.levelService.getLevelsByProperty(propertyId);

      return reply.send({ levels });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
