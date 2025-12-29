import { FastifyInstance } from 'fastify';
import { StagingController } from '../controllers/staging.controller';
import { authenticate } from '../middleware/auth.middleware';

export async function stagingRoutes(server: FastifyInstance) {
  const controller = new StagingController(server);

  // List staging designs
  server.get(
    '/',
    {
      preHandler: [authenticate],
    },
    controller.listDesigns.bind(controller)
  );

  // Get staging design by ID
  server.get(
    '/:id',
    {
      preHandler: [authenticate],
    },
    controller.getDesign.bind(controller)
  );

  // Get ROI report
  server.get(
    '/analytics/roi',
    {
      preHandler: [authenticate],
    },
    controller.getROIReport.bind(controller)
  );

  // Get forecast for item
  server.get(
    '/forecast/:itemId',
    {
      preHandler: [authenticate],
    },
    controller.getForecast.bind(controller)
  );

  // Get reorder recommendations
  server.get(
    '/forecast/reorder-recommendations',
    {
      preHandler: [authenticate],
    },
    controller.getReorderRecommendations.bind(controller)
  );

  // Create staging design
  server.post(
    '/',
    {
      preHandler: [authenticate],
    },
    controller.createDesign.bind(controller)
  );

  // Add item to staging design
  server.post(
    '/items',
    {
      preHandler: [authenticate],
    },
    controller.addItem.bind(controller)
  );

  // Forecast demand for item
  server.post(
    '/forecast/:itemId',
    {
      preHandler: [authenticate],
    },
    controller.forecastDemand.bind(controller)
  );

  // Update staging design
  server.put(
    '/:id',
    {
      preHandler: [authenticate],
    },
    controller.updateDesign.bind(controller)
  );

  // Update staging item
  server.put(
    '/:designId/items/:itemId',
    {
      preHandler: [authenticate],
    },
    controller.updateItem.bind(controller)
  );

  // Implement staging design
  server.post(
    '/:id/implement',
    {
      preHandler: [authenticate],
    },
    controller.implementDesign.bind(controller)
  );

  // Remove staging design
  server.post(
    '/:id/remove',
    {
      preHandler: [authenticate],
    },
    controller.removeDesign.bind(controller)
  );

  // Archive staging design
  server.post(
    '/:id/archive',
    {
      preHandler: [authenticate],
    },
    controller.archiveDesign.bind(controller)
  );

  // Remove item from staging design
  server.delete(
    '/:designId/items/:itemId',
    {
      preHandler: [authenticate],
    },
    controller.removeItem.bind(controller)
  );
}
