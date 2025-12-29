import { FastifyInstance } from 'fastify';
import { InventoryItemController } from '../controllers/inventory-item.controller';
import { authenticate } from '../middleware/auth.middleware';

export async function inventoryItemRoutes(server: FastifyInstance) {
  const controller = new InventoryItemController(server);

  // List items
  server.get(
    '/',
    {
      preHandler: [authenticate],
    },
    controller.listItems.bind(controller)
  );

  // Get item by ID
  server.get(
    '/:id',
    {
      preHandler: [authenticate],
    },
    controller.getItem.bind(controller)
  );

  // Get item by SKU
  server.get(
    '/sku/:sku',
    {
      preHandler: [authenticate],
    },
    controller.getItemBySku.bind(controller)
  );

  // Get item by barcode
  server.get(
    '/barcode/:barcode',
    {
      preHandler: [authenticate],
    },
    controller.getItemByBarcode.bind(controller)
  );

  // Search items
  server.get(
    '/search',
    {
      preHandler: [authenticate],
    },
    controller.searchItems.bind(controller)
  );

  // Get total inventory value
  server.get(
    '/analytics/total-value',
    {
      preHandler: [authenticate],
    },
    controller.getTotalValue.bind(controller)
  );

  // Get category breakdown
  server.get(
    '/analytics/category-breakdown',
    {
      preHandler: [authenticate],
    },
    controller.getCategoryBreakdown.bind(controller)
  );

  // Get items requiring reorder
  server.get(
    '/analytics/reorder',
    {
      preHandler: [authenticate],
    },
    controller.getReorderItems.bind(controller)
  );

  // Create item
  server.post(
    '/',
    {
      preHandler: [authenticate],
    },
    controller.createItem.bind(controller)
  );

  // Batch import items
  server.post(
    '/batch',
    {
      preHandler: [authenticate],
    },
    controller.batchImport.bind(controller)
  );

  // Update item
  server.put(
    '/:id',
    {
      preHandler: [authenticate],
    },
    controller.updateItem.bind(controller)
  );

  // Delete item (soft delete)
  server.delete(
    '/:id',
    {
      preHandler: [authenticate],
    },
    controller.deleteItem.bind(controller)
  );
}
