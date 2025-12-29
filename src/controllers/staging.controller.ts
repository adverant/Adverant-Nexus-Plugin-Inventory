import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StagingService } from '../services/staging.service';
import { ForecastingService } from '../services/forecasting.service';
import {
  CreateStagingDesignDTO,
  UpdateStagingDesignDTO,
  AddStagingItemDTO,
  UpdateStagingItemDTO,
  ListStagingDesignsQuery,
  ForecastDemandDTO,
} from '../types';

export class StagingController {
  private stagingService: StagingService;
  private forecastingService: ForecastingService;

  constructor(private server: FastifyInstance) {
    this.stagingService = new StagingService(server.prisma);
    this.forecastingService = new ForecastingService(server.prisma);
  }

  async listDesigns(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as ListStagingDesignsQuery;
      const result = await this.stagingService.listDesigns(query);
      return reply.send(result);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getDesign(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const design = await this.stagingService.getDesign(id);

      if (!design) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Staging design not found',
        });
      }

      return reply.send(design);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createDesign(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;
      const data = request.body as CreateStagingDesignDTO;

      const design = await this.stagingService.createDesign({
        ...data,
        createdBy: user?.userId,
      });

      return reply.code(201).send(design);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateDesign(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const data = request.body as UpdateStagingDesignDTO;

      const design = await this.stagingService.updateDesign(id, data, user?.userId);

      return reply.send(design);
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

  async addItem(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as AddStagingItemDTO;
      const stagingItem = await this.stagingService.addItem(data);

      return reply.code(201).send(stagingItem);
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

  async updateItem(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { designId, itemId } = request.params as { designId: string; itemId: string };
      const data = request.body as UpdateStagingItemDTO;

      const stagingItem = await this.stagingService.updateStagingItem(designId, itemId, data);

      return reply.send(stagingItem);
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

  async removeItem(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { designId, itemId } = request.params as { designId: string; itemId: string };

      await this.stagingService.removeItem(designId, itemId);

      return reply.code(204).send();
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

  async implementDesign(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const design = await this.stagingService.implementDesign(id, user?.userId);

      return reply.send(design);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('Only draft')) {
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

  async removeDesign(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const design = await this.stagingService.removeDesign(id, user?.userId);

      return reply.send(design);
    } catch (error) {
      this.server.log.error(error);

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('Only active')) {
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

  async archiveDesign(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      const design = await this.stagingService.archiveDesign(id);

      return reply.send(design);
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getROIReport(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.query as { propertyId?: string };
      const report = await this.stagingService.getROIReport(propertyId);

      return reply.send({ report });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async forecastDemand(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { itemId } = request.params as { itemId: string };
      const { propertyId, periodDays } = request.query as {
        propertyId?: string;
        periodDays?: string;
      };

      const forecast = await this.forecastingService.forecastDemand({
        itemId,
        propertyId,
        periodDays: periodDays ? parseInt(periodDays) : 30,
      });

      return reply.send(forecast);
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

  async getForecast(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { itemId } = request.params as { itemId: string };
      const { propertyId } = request.query as { propertyId?: string };

      const forecasts = await this.forecastingService.getForecast(itemId, propertyId);

      return reply.send({ forecasts });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getReorderRecommendations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.query as { propertyId?: string };

      const recommendations = await this.forecastingService.getReorderRecommendations(
        propertyId
      );

      return reply.send({ recommendations });
    } catch (error) {
      this.server.log.error(error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
