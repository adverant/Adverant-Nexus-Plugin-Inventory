import { PrismaClient, StagingStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import {
  CreateStagingDesignDTO,
  UpdateStagingDesignDTO,
  AddStagingItemDTO,
  UpdateStagingItemDTO,
  ListStagingDesignsQuery,
  PaginatedResponse,
  CalculateROIParams,
} from '../types';

export class StagingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * List staging designs with pagination and filters
   */
  async listDesigns(query: ListStagingDesignsQuery): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 20,
      propertyId,
      unitId,
      status,
      roomType,
      style,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (propertyId) where.propertyId = propertyId;
    if (unitId) where.unitId = unitId;
    if (status) where.status = status;
    if (roomType) where.roomType = roomType;
    if (style) where.style = style;

    const [designs, total] = await Promise.all([
      this.prisma.stagingDesign.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: {
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
          },
          _count: {
            select: {
              items: true,
              transactions: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.stagingDesign.count({ where }),
    ]);

    return {
      data: designs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single staging design
   */
  async getDesign(id: string) {
    return this.prisma.stagingDesign.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        transactions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        },
      },
    });
  }

  /**
   * Create a new staging design
   */
  async createDesign(data: CreateStagingDesignDTO) {
    return this.prisma.stagingDesign.create({
      data: {
        ...data,
        beforePhotos: data.beforePhotos || [],
        afterPhotos: data.afterPhotos || [],
        inspirationPhotos: data.inspirationPhotos || [],
        tags: data.tags || [],
        costTotal: new Decimal(0),
      },
      include: {
        items: true,
      },
    });
  }

  /**
   * Update a staging design
   */
  async updateDesign(id: string, data: UpdateStagingDesignDTO, updatedBy?: string) {
    const design = await this.prisma.stagingDesign.findUnique({
      where: { id },
    });

    if (!design) {
      throw new Error('Staging design not found');
    }

    // Calculate ROI if performance metrics are updated
    let roi: number | undefined;
    if (
      data.avgNightlyRateBefore !== undefined &&
      data.avgNightlyRateAfter !== undefined &&
      data.bookingRateBefore !== undefined &&
      data.bookingRateAfter !== undefined
    ) {
      const monthsSince = design.implementedDate
        ? this.getMonthsDifference(design.implementedDate, new Date())
        : 0;

      if (monthsSince > 0) {
        roi = this.calculateROI({
          costTotal: design.costTotal.toNumber(),
          avgNightlyRateBefore: data.avgNightlyRateBefore,
          avgNightlyRateAfter: data.avgNightlyRateAfter,
          bookingRateBefore: data.bookingRateBefore,
          bookingRateAfter: data.bookingRateAfter,
          monthsSinceImplementation: monthsSince,
        });
      }
    }

    return this.prisma.stagingDesign.update({
      where: { id },
      data: {
        ...data,
        roi: roi !== undefined ? new Decimal(roi) : undefined,
        updatedBy,
      },
      include: {
        items: true,
      },
    });
  }

  /**
   * Add item to staging design
   */
  async addItem(data: AddStagingItemDTO) {
    const { stagingDesignId, itemId, quantity, placement, notes } = data;

    // Validate design exists
    const design = await this.prisma.stagingDesign.findUnique({
      where: { id: stagingDesignId },
    });

    if (!design) {
      throw new Error('Staging design not found');
    }

    // Validate item exists
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    // Calculate cost for this item
    const itemCost = new Decimal(item.currentValue).mul(quantity);

    // Create staging item
    const stagingItem = await this.prisma.stagingItem.create({
      data: {
        stagingDesignId,
        itemId,
        quantity,
        placement,
        notes,
        itemCost,
      },
      include: {
        item: true,
        stagingDesign: true,
      },
    });

    // Update total cost of design
    await this.updateDesignTotalCost(stagingDesignId);

    return stagingItem;
  }

  /**
   * Update staging item
   */
  async updateStagingItem(
    stagingDesignId: string,
    itemId: string,
    data: UpdateStagingItemDTO
  ) {
    const stagingItem = await this.prisma.stagingItem.findFirst({
      where: {
        stagingDesignId,
        itemId,
      },
      include: {
        item: true,
      },
    });

    if (!stagingItem) {
      throw new Error('Staging item not found');
    }

    // Recalculate item cost if quantity changed
    let itemCost = stagingItem.itemCost;
    if (data.quantity !== undefined) {
      itemCost = new Decimal(stagingItem.item.currentValue).mul(data.quantity);
    }

    const updated = await this.prisma.stagingItem.update({
      where: {
        id: stagingItem.id,
      },
      data: {
        ...data,
        itemCost,
        placedDate: data.isPlaced ? new Date() : undefined,
      },
      include: {
        item: true,
      },
    });

    // Update total cost of design
    await this.updateDesignTotalCost(stagingDesignId);

    return updated;
  }

  /**
   * Remove item from staging design
   */
  async removeItem(stagingDesignId: string, itemId: string) {
    const stagingItem = await this.prisma.stagingItem.findFirst({
      where: {
        stagingDesignId,
        itemId,
      },
    });

    if (!stagingItem) {
      throw new Error('Staging item not found');
    }

    await this.prisma.stagingItem.delete({
      where: {
        id: stagingItem.id,
      },
    });

    // Update total cost of design
    await this.updateDesignTotalCost(stagingDesignId);

    return { success: true };
  }

  /**
   * Implement staging design (activate and reserve inventory)
   */
  async implementDesign(id: string, implementedBy?: string) {
    const design = await this.prisma.stagingDesign.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!design) {
      throw new Error('Staging design not found');
    }

    if (design.status !== 'DRAFT') {
      throw new Error('Only draft designs can be implemented');
    }

    // Create transactions to reserve inventory for each item
    for (const stagingItem of design.items) {
      await this.prisma.transaction.create({
        data: {
          type: 'ASSIGN',
          status: 'COMPLETED',
          itemId: stagingItem.itemId,
          quantity: stagingItem.quantity,
          fromPropertyId: design.propertyId,
          fromUnitId: design.unitId,
          stagingDesignId: design.id,
          reason: `Assigned to staging design: ${design.name}`,
          createdBy: implementedBy,
          completedAt: new Date(),
        },
      });
    }

    // Update design status
    return this.prisma.stagingDesign.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        implementedDate: new Date(),
        updatedBy: implementedBy,
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });
  }

  /**
   * Remove staging design (deactivate and release inventory)
   */
  async removeDesign(id: string, removedBy?: string) {
    const design = await this.prisma.stagingDesign.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!design) {
      throw new Error('Staging design not found');
    }

    if (design.status !== 'ACTIVE') {
      throw new Error('Only active designs can be removed');
    }

    // Create transactions to release reserved inventory for each item
    for (const stagingItem of design.items) {
      await this.prisma.transaction.create({
        data: {
          type: 'UNASSIGN',
          status: 'COMPLETED',
          itemId: stagingItem.itemId,
          quantity: stagingItem.quantity,
          toPropertyId: design.propertyId,
          toUnitId: design.unitId,
          stagingDesignId: design.id,
          reason: `Unassigned from staging design: ${design.name}`,
          createdBy: removedBy,
          completedAt: new Date(),
        },
      });
    }

    // Update design status
    return this.prisma.stagingDesign.update({
      where: { id },
      data: {
        status: 'REMOVED',
        removedDate: new Date(),
        updatedBy: removedBy,
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });
  }

  /**
   * Archive staging design
   */
  async archiveDesign(id: string) {
    return this.prisma.stagingDesign.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
    });
  }

  /**
   * Get staging designs for a property
   */
  async getDesignsByProperty(propertyId: string, status?: StagingStatus) {
    const where: any = { propertyId };
    if (status) where.status = status;

    return this.prisma.stagingDesign.findMany({
      where,
      include: {
        items: {
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
        },
      },
      orderBy: {
        implementedDate: 'desc',
      },
    });
  }

  /**
   * Get staging ROI report
   */
  async getROIReport(propertyId?: string) {
    const where: any = {
      status: 'ACTIVE',
      implementedDate: { not: null },
      roi: { not: null },
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const designs = await this.prisma.stagingDesign.findMany({
      where,
      select: {
        id: true,
        name: true,
        propertyId: true,
        roomName: true,
        roomType: true,
        style: true,
        costTotal: true,
        implementedDate: true,
        avgNightlyRateBefore: true,
        avgNightlyRateAfter: true,
        bookingRateBefore: true,
        bookingRateAfter: true,
        roi: true,
      },
      orderBy: {
        roi: 'desc',
      },
    });

    return designs.map((design) => ({
      ...design,
      monthsActive: design.implementedDate
        ? this.getMonthsDifference(design.implementedDate, new Date())
        : 0,
      rateIncrease: design.avgNightlyRateAfter && design.avgNightlyRateBefore
        ? ((design.avgNightlyRateAfter.toNumber() - design.avgNightlyRateBefore.toNumber()) / design.avgNightlyRateBefore.toNumber() * 100)
        : 0,
      bookingIncrease: design.bookingRateAfter && design.bookingRateBefore
        ? ((design.bookingRateAfter.toNumber() - design.bookingRateBefore.toNumber()) / design.bookingRateBefore.toNumber() * 100)
        : 0,
    }));
  }

  /**
   * Calculate ROI for staging design
   */
  calculateROI(params: CalculateROIParams): number {
    const {
      costTotal,
      avgNightlyRateBefore,
      avgNightlyRateAfter,
      bookingRateBefore,
      bookingRateAfter,
      monthsSinceImplementation,
    } = params;

    // Calculate additional revenue
    const daysPerMonth = 30;
    const monthsToConsider = monthsSinceImplementation;

    // Revenue before staging
    const monthlyRevenueBefore = avgNightlyRateBefore * daysPerMonth * (bookingRateBefore / 100);

    // Revenue after staging
    const monthlyRevenueAfter = avgNightlyRateAfter * daysPerMonth * (bookingRateAfter / 100);

    // Total additional revenue
    const additionalRevenue = (monthlyRevenueAfter - monthlyRevenueBefore) * monthsToConsider;

    // ROI = (Gain - Cost) / Cost * 100
    const roi = ((additionalRevenue - costTotal) / costTotal) * 100;

    return Math.round(roi * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Update design total cost based on staging items
   */
  private async updateDesignTotalCost(stagingDesignId: string) {
    const items = await this.prisma.stagingItem.findMany({
      where: { stagingDesignId },
    });

    const totalItemCost = items.reduce(
      (sum, item) => sum.add(item.itemCost),
      new Decimal(0)
    );

    const design = await this.prisma.stagingDesign.findUnique({
      where: { id: stagingDesignId },
    });

    const laborCost = design?.laborCost || new Decimal(0);
    const costTotal = totalItemCost.add(laborCost);

    await this.prisma.stagingDesign.update({
      where: { id: stagingDesignId },
      data: {
        costTotal,
      },
    });
  }

  /**
   * Get months difference between two dates
   */
  private getMonthsDifference(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return (
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth())
    );
  }
}
