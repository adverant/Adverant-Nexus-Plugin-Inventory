import { PrismaClient, ItemCategory, ItemCondition } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateInventoryItemDTO,
  UpdateInventoryItemDTO,
  ListInventoryItemsQuery,
  PaginatedResponse,
} from '../types';

export class InventoryItemService {
  constructor(private prisma: PrismaClient) {}

  /**
   * List inventory items with pagination and filters
   */
  async listItems(query: ListInventoryItemsQuery): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 20,
      category,
      condition,
      search,
      vendorId,
      isActive = true,
      lowStock = false,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (category) where.category = category;
    if (condition) where.condition = condition;
    if (vendorId) where.vendorId = vendorId;
    if (isActive !== undefined) where.isActive = isActive;

    // Search across multiple fields
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        include: {
          levels: {
            select: {
              id: true,
              propertyId: true,
              locationName: true,
              quantityOnHand: true,
              quantityReserved: true,
              quantityAvailable: true,
              alertLevel: true,
            },
          },
          _count: {
            select: {
              transactions: true,
              stagingItems: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    // Filter for low stock if requested
    let filteredItems = items;
    if (lowStock) {
      filteredItems = items.filter((item) =>
        item.levels.some((level) => level.alertLevel === 'CRITICAL' || level.alertLevel === 'LOW')
      );
    }

    return {
      data: filteredItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single inventory item by ID
   */
  async getItem(id: string) {
    return this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        levels: {
          include: {
            _count: {
              select: {
                id: true,
              },
            },
          },
        },
        transactions: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
        stagingItems: {
          include: {
            stagingDesign: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        forecasts: {
          where: {
            forecastDate: {
              gte: new Date(),
            },
          },
          orderBy: {
            forecastDate: 'asc',
          },
          take: 30,
        },
      },
    });
  }

  /**
   * Get item by SKU
   */
  async getItemBySku(sku: string) {
    return this.prisma.inventoryItem.findUnique({
      where: { sku },
      include: {
        levels: true,
      },
    });
  }

  /**
   * Get item by barcode
   */
  async getItemByBarcode(barcode: string) {
    return this.prisma.inventoryItem.findUnique({
      where: { barcode },
      include: {
        levels: true,
      },
    });
  }

  /**
   * Create a new inventory item
   */
  async createItem(data: CreateInventoryItemDTO, createdBy?: string) {
    // Check if SKU already exists
    const existingSku = await this.prisma.inventoryItem.findUnique({
      where: { sku: data.sku },
    });

    if (existingSku) {
      throw new Error(`Item with SKU ${data.sku} already exists`);
    }

    // Check if barcode already exists (if provided)
    if (data.barcode) {
      const existingBarcode = await this.prisma.inventoryItem.findUnique({
        where: { barcode: data.barcode },
      });

      if (existingBarcode) {
        throw new Error(`Item with barcode ${data.barcode} already exists`);
      }
    }

    return this.prisma.inventoryItem.create({
      data: {
        ...data,
        currentValue: data.currentValue || data.purchaseCost,
        photos: data.photos || [],
        documents: data.documents || [],
        tags: data.tags || [],
        createdBy,
      },
      include: {
        levels: true,
      },
    });
  }

  /**
   * Update an inventory item
   */
  async updateItem(id: string, data: UpdateInventoryItemDTO, updatedBy?: string) {
    // If updating SKU, check it's not already taken
    if (data.sku) {
      const existing = await this.prisma.inventoryItem.findFirst({
        where: {
          sku: data.sku,
          NOT: { id },
        },
      });

      if (existing) {
        throw new Error(`Item with SKU ${data.sku} already exists`);
      }
    }

    // If updating barcode, check it's not already taken
    if (data.barcode) {
      const existing = await this.prisma.inventoryItem.findFirst({
        where: {
          barcode: data.barcode,
          NOT: { id },
        },
      });

      if (existing) {
        throw new Error(`Item with barcode ${data.barcode} already exists`);
      }
    }

    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...data,
        updatedBy,
      },
      include: {
        levels: true,
      },
    });
  }

  /**
   * Delete (soft delete) an inventory item
   */
  async deleteItem(id: string) {
    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Get total inventory value across all items
   */
  async getTotalInventoryValue() {
    const result = await this.prisma.inventoryItem.aggregate({
      where: {
        isActive: true,
      },
      _sum: {
        currentValue: true,
      },
    });

    return result._sum.currentValue || 0;
  }

  /**
   * Get inventory breakdown by category
   */
  async getCategoryBreakdown() {
    const items = await this.prisma.inventoryItem.groupBy({
      by: ['category'],
      where: {
        isActive: true,
      },
      _count: {
        id: true,
      },
      _sum: {
        currentValue: true,
      },
    });

    return items.map((item) => ({
      category: item.category,
      count: item._count.id,
      value: item._sum.currentValue || 0,
    }));
  }

  /**
   * Get items requiring reorder
   */
  async getItemsRequiringReorder() {
    const levels = await this.prisma.inventoryLevel.findMany({
      where: {
        alertLevel: {
          in: ['CRITICAL', 'LOW'],
        },
      },
      include: {
        item: true,
      },
    });

    return levels.map((level) => ({
      item: level.item,
      level,
      recommendedOrder: level.item.reorderQuantity,
    }));
  }

  /**
   * Batch import items from CSV data
   */
  async batchImportItems(items: CreateInventoryItemDTO[], createdBy?: string) {
    const results = {
      success: [] as any[],
      errors: [] as any[],
    };

    for (const itemData of items) {
      try {
        const item = await this.createItem(itemData, createdBy);
        results.success.push(item);
      } catch (error) {
        results.errors.push({
          sku: itemData.sku,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Search items by multiple criteria
   */
  async searchItems(searchTerm: string, category?: ItemCategory) {
    const where: any = {
      isActive: true,
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
        { model: { contains: searchTerm, mode: 'insensitive' } },
        { tags: { has: searchTerm } },
      ],
    };

    if (category) {
      where.category = category;
    }

    return this.prisma.inventoryItem.findMany({
      where,
      include: {
        levels: {
          select: {
            propertyId: true,
            locationName: true,
            quantityOnHand: true,
            quantityAvailable: true,
          },
        },
      },
      take: 20,
    });
  }

  /**
   * Get items by vendor
   */
  async getItemsByVendor(vendorId: string) {
    return this.prisma.inventoryItem.findMany({
      where: {
        vendorId,
        isActive: true,
      },
      include: {
        levels: true,
      },
    });
  }

  /**
   * Update item condition
   */
  async updateItemCondition(id: string, condition: ItemCondition, notes?: string) {
    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        condition,
        notes: notes ? `${notes}\n\nCondition updated to ${condition}` : undefined,
      },
    });
  }
}
