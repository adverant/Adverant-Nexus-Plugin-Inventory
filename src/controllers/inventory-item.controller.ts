import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InventoryItemService } from '../services/inventory-item.service';
import {
  CreateInventoryItemDTO,
  UpdateInventoryItemDTO,
  ListInventoryItemsQuery,
} from '../types';

export class InventoryItemController {
  private itemService: InventoryItemService;

  constructor(private server: FastifyInstance) {
    this.itemService = new InventoryItemService(server.prisma);
  }

  async listItems(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as ListInventoryItemsQuery;
      const result = await this.itemService.listItems(query);
      return reply.send(result);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getItem(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const item = await this.itemService.getItem(id);

      if (!item) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Inventory item not found',
        });
      }

      return reply.send(item);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getItemBySku(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { sku } = request.params as { sku: string };
      const item = await this.itemService.getItemBySku(sku);

      if (!item) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Inventory item not found',
        });
      }

      return reply.send(item);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getItemByBarcode(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { barcode } = request.params as { barcode: string };
      const item = await this.itemService.getItemByBarcode(barcode);

      if (!item) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Inventory item not found',
        });
      }

      return reply.send(item);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createItem(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const data = request.body as CreateInventoryItemDTO;

      const item = await this.itemService.createItem(data, user?.userId);

      return reply.code(201).send(item);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('already exists')) {
        return reply.code(409).send({
          error: 'Conflict',
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateItem(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const data = request.body as UpdateInventoryItemDTO;

      const item = await this.itemService.updateItem(id, data, user?.userId);

      return reply.send(item);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('already exists')) {
        return reply.code(409).send({
          error: 'Conflict',
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteItem(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      await this.itemService.deleteItem(id);

      return reply.code(204).send();
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTotalValue(request: FastifyRequest, reply: FastifyReply) {
    try {
      const totalValue = await this.itemService.getTotalInventoryValue();

      return reply.send({ totalValue });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getCategoryBreakdown(request: FastifyRequest, reply: FastifyReply) {
    try {
      const breakdown = await this.itemService.getCategoryBreakdown();

      return reply.send({ breakdown });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getReorderItems(request: FastifyRequest, reply: FastifyReply) {
    try {
      const items = await this.itemService.getItemsRequiringReorder();

      return reply.send({ items });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async searchItems(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { q, category } = request.query as { q: string; category?: string };

      if (!q) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Search query (q) is required',
        });
      }

      const items = await this.itemService.searchItems(q, category as any);

      return reply.send({ items });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async batchImport(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const { items } = request.body as { items: CreateInventoryItemDTO[] };

      if (!Array.isArray(items) || items.length === 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Items array is required and must not be empty',
        });
      }

      const result = await this.itemService.batchImportItems(items, user?.userId);

      return reply.send(result);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
