import { PrismaClient, StockAlertLevel } from '@prisma/client';
import { Decimal } from 'decimal.js';
import {
  CreateInventoryLevelDTO,
  UpdateInventoryLevelDTO,
  AdjustInventoryDTO,
  ListInventoryLevelsQuery,
  PaginatedResponse,
  LowStockAlert,
} from '../types';
import { config } from '../config/config';

export class InventoryLevelService {
  constructor(private prisma: PrismaClient) {}

  /**
   * List inventory levels with pagination and filters
   */
  async listLevels(query: ListInventoryLevelsQuery): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 20,
      itemId,
      propertyId,
      unitId,
      alertLevel,
      lowStock = false,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (itemId) where.itemId = itemId;
    if (propertyId) where.propertyId = propertyId;
    if (unitId) where.unitId = unitId;
    if (alertLevel) where.alertLevel = alertLevel;

    if (lowStock) {
      where.alertLevel = {
        in: ['CRITICAL', 'LOW'],
      };
    }

    const [levels, total] = await Promise.all([
      this.prisma.inventoryLevel.findMany({
        where,
        skip,
        take: limit,
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              category: true,
              condition: true,
              photos: true,
            },
          },
        },
        orderBy: [
          { alertLevel: 'asc' }, // Critical first
          { updatedAt: 'desc' },
        ],
      }),
      this.prisma.inventoryLevel.count({ where }),
    ]);

    return {
      data: levels,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get inventory level by ID
   */
  async getLevel(id: string) {
    return this.prisma.inventoryLevel.findUnique({
      where: { id },
      include: {
        item: true,
      },
    });
  }

  /**
   * Get inventory level for specific item and location
   */
  async getLevelByLocation(
    itemId: string,
    propertyId: string,
    unitId?: string,
    roomId?: string
  ) {
    return this.prisma.inventoryLevel.findFirst({
      where: {
        itemId,
        propertyId,
        unitId: unitId || null,
        roomId: roomId || null,
      },
      include: {
        item: true,
      },
    });
  }

  /**
   * Create a new inventory level
   */
  async createLevel(data: CreateInventoryLevelDTO) {
    const { itemId, propertyId, unitId, roomId, locationName } = data;

    // Build location path
    const locationPath = this.buildLocationPath(propertyId, unitId, roomId, locationName);

    // Get item to check reorder settings
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const quantityOnHand = data.quantityOnHand || 0;
    const minQuantity = data.minQuantity ?? item.reorderPoint;
    const maxQuantity = data.maxQuantity ?? item.maxQuantity;
    const reorderPoint = data.reorderPoint ?? item.reorderPoint;

    // Calculate alert level
    const alertLevel = this.calculateAlertLevel(
      quantityOnHand,
      reorderPoint,
      maxQuantity
    );

    return this.prisma.inventoryLevel.create({
      data: {
        ...data,
        locationPath,
        quantityOnHand,
        quantityReserved: 0,
        quantityAvailable: quantityOnHand,
        minQuantity,
        maxQuantity,
        reorderPoint,
        alertLevel,
      },
      include: {
        item: true,
      },
    });
  }

  /**
   * Update inventory level
   */
  async updateLevel(id: string, data: UpdateInventoryLevelDTO) {
    const level = await this.prisma.inventoryLevel.findUnique({
      where: { id },
      include: { item: true },
    });

    if (!level) {
      throw new Error('Inventory level not found');
    }

    const quantityOnHand = data.quantityOnHand ?? level.quantityOnHand;
    const quantityReserved = data.quantityReserved ?? level.quantityReserved;
    const quantityAvailable = quantityOnHand - quantityReserved;

    const reorderPoint = data.reorderPoint ?? level.reorderPoint ?? level.item.reorderPoint;
    const maxQuantity = data.maxQuantity ?? level.maxQuantity ?? level.item.maxQuantity;

    const alertLevel = this.calculateAlertLevel(
      quantityOnHand,
      reorderPoint,
      maxQuantity
    );

    return this.prisma.inventoryLevel.update({
      where: { id },
      data: {
        ...data,
        quantityAvailable,
        alertLevel,
      },
      include: {
        item: true,
      },
    });
  }

  /**
   * Adjust inventory quantity
   */
  async adjustInventory(data: AdjustInventoryDTO) {
    const { itemId, propertyId, unitId, roomId, quantity, reason, reasonCode, notes, createdBy } = data;

    // Find or create inventory level
    let level = await this.getLevelByLocation(itemId, propertyId, unitId, roomId);

    if (!level) {
      // Create new level if doesn't exist
      const item = await this.prisma.inventoryItem.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      level = await this.createLevel({
        itemId,
        propertyId,
        unitId,
        roomId,
        locationName: `${propertyId}${unitId ? `/${unitId}` : ''}${roomId ? `/${roomId}` : ''}`,
        quantityOnHand: 0,
      });
    }

    const newQuantity = level.quantityOnHand + quantity;

    if (newQuantity < 0) {
      throw new Error('Insufficient inventory quantity');
    }

    // Update the level
    const updatedLevel = await this.updateLevel(level.id, {
      quantityOnHand: newQuantity,
    });

    // Create transaction record for the adjustment
    await this.prisma.transaction.create({
      data: {
        type: 'ADJUST',
        status: 'COMPLETED',
        itemId,
        quantity: Math.abs(quantity),
        toPropertyId: quantity > 0 ? propertyId : undefined,
        toUnitId: quantity > 0 ? unitId : undefined,
        toRoomId: quantity > 0 ? roomId : undefined,
        fromPropertyId: quantity < 0 ? propertyId : undefined,
        fromUnitId: quantity < 0 ? unitId : undefined,
        fromRoomId: quantity < 0 ? roomId : undefined,
        reason: reason || (quantity > 0 ? 'Inventory increase' : 'Inventory decrease'),
        reasonCode,
        notes,
        createdBy,
        completedAt: new Date(),
      },
    });

    // Check if alert should be created
    await this.checkAndCreateAlert(updatedLevel);

    return updatedLevel;
  }

  /**
   * Reserve inventory (for staging, orders, etc.)
   */
  async reserveInventory(
    itemId: string,
    propertyId: string,
    quantity: number,
    unitId?: string,
    roomId?: string
  ) {
    const level = await this.getLevelByLocation(itemId, propertyId, unitId, roomId);

    if (!level) {
      throw new Error('Inventory level not found');
    }

    if (level.quantityAvailable < quantity) {
      throw new Error('Insufficient available inventory');
    }

    return this.updateLevel(level.id, {
      quantityReserved: level.quantityReserved + quantity,
    });
  }

  /**
   * Release reserved inventory
   */
  async releaseReservedInventory(
    itemId: string,
    propertyId: string,
    quantity: number,
    unitId?: string,
    roomId?: string
  ) {
    const level = await this.getLevelByLocation(itemId, propertyId, unitId, roomId);

    if (!level) {
      throw new Error('Inventory level not found');
    }

    if (level.quantityReserved < quantity) {
      throw new Error('Cannot release more than reserved quantity');
    }

    return this.updateLevel(level.id, {
      quantityReserved: level.quantityReserved - quantity,
    });
  }

  /**
   * Perform cycle count
   */
  async cycleCount(
    levelId: string,
    countedQuantity: number,
    countedBy: string,
    notes?: string
  ) {
    const level = await this.prisma.inventoryLevel.findUnique({
      where: { id: levelId },
      include: { item: true },
    });

    if (!level) {
      throw new Error('Inventory level not found');
    }

    const variance = countedQuantity - level.quantityOnHand;

    // Update the level
    const updatedLevel = await this.prisma.inventoryLevel.update({
      where: { id: levelId },
      data: {
        quantityOnHand: countedQuantity,
        quantityAvailable: countedQuantity - level.quantityReserved,
        lastCountedDate: new Date(),
        lastCountedBy: countedBy,
        notes: notes ? `${level.notes || ''}\n${notes}` : level.notes,
      },
      include: {
        item: true,
      },
    });

    // Create adjustment transaction if there's a variance
    if (variance !== 0) {
      await this.prisma.transaction.create({
        data: {
          type: 'ADJUST',
          status: 'COMPLETED',
          itemId: level.itemId,
          quantity: Math.abs(variance),
          toPropertyId: variance > 0 ? level.propertyId : undefined,
          toUnitId: variance > 0 ? level.unitId : undefined,
          toRoomId: variance > 0 ? level.roomId : undefined,
          fromPropertyId: variance < 0 ? level.propertyId : undefined,
          fromUnitId: variance < 0 ? level.unitId : undefined,
          fromRoomId: variance < 0 ? level.roomId : undefined,
          reason: 'Cycle count adjustment',
          reasonCode: 'CYCLE_COUNT',
          notes: `Variance: ${variance}. ${notes || ''}`,
          createdBy: countedBy,
          completedAt: new Date(),
        },
      });
    }

    return {
      level: updatedLevel,
      variance,
    };
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(propertyId?: string): Promise<LowStockAlert[]> {
    const where: any = {
      alertLevel: {
        in: ['CRITICAL', 'LOW'],
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

    return levels.map((level) => ({
      itemId: level.item.id,
      itemName: level.item.name,
      sku: level.item.sku,
      propertyId: level.propertyId,
      locationName: level.locationName,
      currentQuantity: level.quantityOnHand,
      reorderPoint: level.reorderPoint || level.item.reorderPoint,
      alertLevel: level.alertLevel,
      recommendedOrder: level.item.reorderQuantity,
    }));
  }

  /**
   * Get inventory levels for a specific property
   */
  async getLevelsByProperty(propertyId: string) {
    return this.prisma.inventoryLevel.findMany({
      where: { propertyId },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            category: true,
            photos: true,
          },
        },
      },
      orderBy: {
        locationPath: 'asc',
      },
    });
  }

  /**
   * Calculate alert level based on quantity and thresholds
   */
  private calculateAlertLevel(
    quantity: number,
    reorderPoint: number | null,
    maxQuantity: number | null
  ): StockAlertLevel {
    if (reorderPoint === null || reorderPoint === 0) {
      return 'NORMAL';
    }

    const criticalThreshold = reorderPoint * config.stockAlert.criticalThreshold;
    const lowThreshold = reorderPoint * config.stockAlert.lowThreshold;

    if (quantity <= criticalThreshold) {
      return 'CRITICAL';
    }

    if (quantity <= lowThreshold) {
      return 'LOW';
    }

    if (maxQuantity && quantity >= maxQuantity * config.stockAlert.overstockThreshold) {
      return 'OVERSTOCK';
    }

    if (maxQuantity && quantity >= maxQuantity * config.stockAlert.highThreshold) {
      return 'HIGH';
    }

    return 'NORMAL';
  }

  /**
   * Build location path string
   */
  private buildLocationPath(
    propertyId: string,
    unitId?: string,
    roomId?: string,
    locationName?: string
  ): string {
    const parts = [propertyId];
    if (unitId) parts.push(unitId);
    if (roomId) parts.push(roomId);
    if (locationName) parts.push(locationName);
    return parts.join('/');
  }

  /**
   * Check and create stock alert if needed
   */
  private async checkAndCreateAlert(level: any) {
    if (level.alertLevel === 'CRITICAL' || level.alertLevel === 'LOW') {
      // Check if alert already exists for this level
      const existingAlert = await this.prisma.stockAlert.findFirst({
        where: {
          itemId: level.itemId,
          levelId: level.id,
          isResolved: false,
        },
      });

      if (!existingAlert) {
        await this.prisma.stockAlert.create({
          data: {
            itemId: level.itemId,
            levelId: level.id,
            alertType: level.alertLevel,
            message: `${level.item.name} is ${level.alertLevel.toLowerCase()} at ${level.locationName}`,
            severity: level.alertLevel === 'CRITICAL' ? 'critical' : 'high',
            currentQuantity: level.quantityOnHand,
            reorderPoint: level.reorderPoint || level.item.reorderPoint,
          },
        });
      }
    }
  }
}
