import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dayjs from 'dayjs';
import { config } from '../config/config';
import { ForecastDemandDTO, DemandForecastResult } from '../types';

export class ForecastingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Forecast demand for an item using Prophet service
   */
  async forecastDemand(data: ForecastDemandDTO): Promise<DemandForecastResult> {
    const { itemId, propertyId, periodDays = 30 } = data;

    // Validate item exists
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        levels: propertyId
          ? {
              where: { propertyId },
            }
          : true,
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    // Get historical consumption data
    const historicalData = await this.getHistoricalConsumption(
      itemId,
      propertyId,
      config.forecasting.historicalDays
    );

    if (historicalData.length < 7) {
      throw new Error('Insufficient historical data for forecasting (minimum 7 days required)');
    }

    // Call Prophet forecasting service
    let forecastData;
    try {
      const response = await axios.post(`${config.prophetServiceUrl}/forecast`, {
        historical_data: historicalData,
        periods: periodDays,
        item_id: itemId,
        property_id: propertyId,
      });

      forecastData = response.data;
    } catch (error) {
      // Fallback to simple moving average if Prophet service unavailable
      console.warn('Prophet service unavailable, using simple forecast', error);
      forecastData = this.simpleMovingAverageForecast(historicalData, periodDays);
    }

    // Store forecasts in database
    await this.storeForecastResults(itemId, propertyId, forecastData);

    // Calculate safety stock and reorder recommendations
    const avgDemand = forecastData.forecasts.reduce(
      (sum: number, f: any) => sum + f.predictedDemand,
      0
    ) / forecastData.forecasts.length;

    const stdDev = this.calculateStdDev(
      forecastData.forecasts.map((f: any) => f.predictedDemand)
    );

    const safetyStock = Math.ceil(stdDev * 1.65); // 95% service level
    const avgLeadTime = 7; // days
    const recommendedOrder = Math.ceil(avgDemand * avgLeadTime + safetyStock);

    return {
      itemId,
      propertyId,
      forecasts: forecastData.forecasts,
      recommendedOrder,
      safetyStock,
    };
  }

  /**
   * Get historical consumption data
   */
  async getHistoricalConsumption(
    itemId: string,
    propertyId?: string,
    days: number = 90
  ): Promise<Array<{ date: string; quantity: number }>> {
    const startDate = dayjs().subtract(days, 'days').toDate();

    const where: any = {
      itemId,
      type: 'CONSUME',
      status: 'COMPLETED',
      transactionDate: {
        gte: startDate,
      },
    };

    if (propertyId) {
      where.fromPropertyId = propertyId;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: {
        transactionDate: true,
        quantity: true,
      },
      orderBy: {
        transactionDate: 'asc',
      },
    });

    // Group by date and sum quantities
    const dailyConsumption = new Map<string, number>();

    // Initialize all dates with 0
    for (let i = 0; i < days; i++) {
      const date = dayjs().subtract(i, 'days').format('YYYY-MM-DD');
      dailyConsumption.set(date, 0);
    }

    // Add actual consumption
    transactions.forEach((t) => {
      const date = dayjs(t.transactionDate).format('YYYY-MM-DD');
      const current = dailyConsumption.get(date) || 0;
      dailyConsumption.set(date, current + t.quantity);
    });

    // Convert to array and sort by date
    return Array.from(dailyConsumption.entries())
      .map(([date, quantity]) => ({ date, quantity }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Store forecast results in database
   */
  private async storeForecastResults(
    itemId: string,
    propertyId: string | undefined,
    forecastData: any
  ) {
    const forecasts = forecastData.forecasts.map((f: any) => ({
      itemId,
      propertyId: propertyId || null,
      forecastDate: new Date(),
      periodStart: new Date(f.date),
      periodEnd: dayjs(f.date).add(1, 'day').toDate(),
      predictedDemand: f.predictedDemand,
      lowerBound: f.lowerBound,
      upperBound: f.upperBound,
      confidence: f.confidence,
      seasonalFactor: forecastData.seasonal_factor,
      trendFactor: forecastData.trend_factor,
      modelVersion: forecastData.model_version || 'prophet-v1',
      modelParameters: forecastData.parameters || {},
    }));

    // Delete old forecasts for this item/property
    await this.prisma.demandForecast.deleteMany({
      where: {
        itemId,
        propertyId: propertyId || null,
        forecastDate: {
          lt: dayjs().subtract(7, 'days').toDate(),
        },
      },
    });

    // Insert new forecasts
    await this.prisma.demandForecast.createMany({
      data: forecasts,
    });
  }

  /**
   * Simple moving average forecast (fallback when Prophet unavailable)
   */
  private simpleMovingAverageForecast(
    historicalData: Array<{ date: string; quantity: number }>,
    periods: number
  ) {
    const recentData = historicalData.slice(-14); // Last 14 days
    const avgDemand =
      recentData.reduce((sum, d) => sum + d.quantity, 0) / recentData.length;

    const forecasts = [];
    for (let i = 1; i <= periods; i++) {
      const date = dayjs().add(i, 'days').format('YYYY-MM-DD');
      forecasts.push({
        date,
        predictedDemand: avgDemand,
        lowerBound: avgDemand * 0.7,
        upperBound: avgDemand * 1.3,
        confidence: 0.6,
      });
    }

    return {
      forecasts,
      seasonal_factor: 1.0,
      trend_factor: 1.0,
      model_version: 'simple-ma',
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squareDiffs = values.map((val) => Math.pow(val - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Get forecast for item
   */
  async getForecast(itemId: string, propertyId?: string) {
    const where: any = {
      itemId,
      forecastDate: {
        gte: dayjs().subtract(7, 'days').toDate(),
      },
      periodStart: {
        gte: new Date(),
      },
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    return this.prisma.demandForecast.findMany({
      where,
      orderBy: {
        periodStart: 'asc',
      },
    });
  }

  /**
   * Update all forecasts (background job)
   */
  async updateAllForecasts() {
    // Get all consumable items with recent activity
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        category: {
          in: ['CONSUMABLE', 'CLEANING', 'LINENS'],
        },
        isActive: true,
      },
      include: {
        transactions: {
          where: {
            type: 'CONSUME',
            transactionDate: {
              gte: dayjs().subtract(90, 'days').toDate(),
            },
          },
          take: 1,
        },
        levels: {
          select: {
            propertyId: true,
          },
        },
      },
    });

    const results = [];

    for (const item of items) {
      // Skip if no recent consumption
      if (item.transactions.length === 0) {
        continue;
      }

      // Get unique properties
      const properties = [...new Set(item.levels.map((l) => l.propertyId))];

      // Forecast for each property
      for (const propertyId of properties) {
        try {
          const forecast = await this.forecastDemand({
            itemId: item.id,
            propertyId,
            periodDays: config.forecasting.forecastDays,
          });

          results.push({
            itemId: item.id,
            propertyId,
            success: true,
            forecast,
          });
        } catch (error) {
          results.push({
            itemId: item.id,
            propertyId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Get items that need reordering based on forecasts
   */
  async getReorderRecommendations(propertyId?: string) {
    const where: any = {
      item: {
        category: {
          in: ['CONSUMABLE', 'CLEANING', 'LINENS'],
        },
        isActive: true,
      },
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const levels = await this.prisma.inventoryLevel.findMany({
      where,
      include: {
        item: true,
      },
    });

    const recommendations = [];

    for (const level of levels) {
      // Get latest forecast
      const forecasts = await this.getForecast(level.itemId, level.propertyId);

      if (forecasts.length === 0) {
        continue;
      }

      // Calculate next 7 days demand
      const next7DaysDemand = forecasts
        .slice(0, 7)
        .reduce((sum, f) => sum + f.predictedDemand.toNumber(), 0);

      const leadTimeDemand = Math.ceil(next7DaysDemand);

      // Check if current stock is below lead time demand + safety stock
      const safetyStock = level.item.reorderPoint * 0.5; // 50% of reorder point
      const reorderLevel = leadTimeDemand + safetyStock;

      if (level.quantityAvailable < reorderLevel) {
        recommendations.push({
          item: level.item,
          level,
          currentStock: level.quantityAvailable,
          forecastedDemand: Math.ceil(next7DaysDemand),
          reorderLevel: Math.ceil(reorderLevel),
          recommendedOrder: Math.ceil(level.item.reorderQuantity),
          daysOfStock: level.quantityAvailable / (next7DaysDemand / 7),
        });
      }
    }

    return recommendations.sort((a, b) => a.daysOfStock - b.daysOfStock);
  }
}
