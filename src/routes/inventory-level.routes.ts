import { FastifyInstance } from 'fastify';
import { InventoryLevelController } from '../controllers/inventory-level.controller';
import { authenticate } from '../middleware/auth.middleware';

export async function inventoryLevelRoutes(server: FastifyInstance) {
  const controller = new InventoryLevelController(server);

  // List levels
  server.get(
    '/',
    {
      preHandler: [authenticate],
    },
    controller.listLevels.bind(controller)
  );

  // Get level by ID
  server.get(
    '/:id',
    {
      preHandler: [authenticate],
    },
    controller.getLevel.bind(controller)
  );

  // Get level by location
  server.get(
    '/location',
    {
      preHandler: [authenticate],
    },
    controller.getLevelByLocation.bind(controller)
  );

  // Get levels by property
  server.get(
    '/property/:propertyId',
    {
      preHandler: [authenticate],
    },
    controller.getLevelsByProperty.bind(controller)
  );

  // Get low stock alerts
  server.get(
    '/alerts/low-stock',
    {
      preHandler: [authenticate],
    },
    controller.getLowStockAlerts.bind(controller)
  );

  // Create level
  server.post(
    '/',
    {
      preHandler: [authenticate],
    },
    controller.createLevel.bind(controller)
  );

  // Adjust inventory
  server.post(
    '/adjust',
    {
      preHandler: [authenticate],
    },
    controller.adjustInventory.bind(controller)
  );

  // Reserve inventory
  server.post(
    '/reserve',
    {
      preHandler: [authenticate],
    },
    controller.reserveInventory.bind(controller)
  );

  // Release reserved inventory
  server.post(
    '/release',
    {
      preHandler: [authenticate],
    },
    controller.releaseReservedInventory.bind(controller)
  );

  // Cycle count
  server.post(
    '/cycle-count',
    {
      preHandler: [authenticate],
    },
    controller.cycleCount.bind(controller)
  );

  // Update level
  server.put(
    '/:id',
    {
      preHandler: [authenticate],
    },
    controller.updateLevel.bind(controller)
  );
}
