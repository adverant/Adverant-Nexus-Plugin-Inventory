import { PrismaClient, TransactionType, TransactionStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import {
  CreateTransactionDTO,
  ApproveTransactionDTO,
  RejectTransactionDTO,
  TransferInventoryDTO,
  ListTransactionsQuery,
  PaginatedResponse,
} from '../types';
import { InventoryLevelService } from './inventory-level.service';

export class TransactionService {
  private levelService: InventoryLevelService;

  constructor(private prisma: PrismaClient) {
    this.levelService = new InventoryLevelService(prisma);
  }

  /**
   * List transactions with pagination and filters
   */
  async listTransactions(query: ListTransactionsQuery): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      itemId,
      propertyId,
      startDate,
      endDate,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (itemId) where.itemId = itemId;

    if (propertyId) {
      where.OR = [
        { fromPropertyId: propertyId },
        { toPropertyId: propertyId },
      ];
    }

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = new Date(startDate);
      if (endDate) where.transactionDate.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
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
              photos: true,
            },
          },
          stagingDesign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: {
          transactionDate: 'desc',
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single transaction
   */
  async getTransaction(id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: {
        item: true,
        stagingDesign: true,
      },
    });
  }

  /**
   * Create a new transaction
   */
  async createTransaction(data: CreateTransactionDTO) {
    const { type, itemId, quantity, unitCost } = data;

    // Validate item exists
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    // Calculate total cost
    const totalCost = unitCost ? new Decimal(unitCost).mul(quantity).toNumber() : undefined;

    // Create the transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        ...data,
        totalCost,
        status: data.requiresApproval ? 'PENDING' : 'APPROVED',
      },
      include: {
        item: true,
      },
    });

    // If auto-approved, process immediately
    if (!data.requiresApproval) {
      await this.processTransaction(transaction.id);
    }

    return transaction;
  }

  /**
   * Approve a pending transaction
   */
  async approveTransaction(id: string, data: ApproveTransactionDTO) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'PENDING') {
      throw new Error('Transaction is not pending approval');
    }

    // Update transaction
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: data.approvedBy,
        approvedAt: new Date(),
        notes: data.notes ? `${transaction.notes || ''}\nApproval: ${data.notes}` : transaction.notes,
      },
      include: {
        item: true,
      },
    });

    // Process the transaction
    await this.processTransaction(id);

    return updated;
  }

  /**
   * Reject a pending transaction
   */
  async rejectTransaction(id: string, data: RejectTransactionDTO) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'PENDING') {
      throw new Error('Transaction is not pending approval');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: data.rejectionReason,
        approvedBy: data.rejectedBy,
        approvedAt: new Date(),
      },
      include: {
        item: true,
      },
    });
  }

  /**
   * Process a transaction (update inventory levels)
   */
  async processTransaction(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { item: true },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status === 'COMPLETED') {
      throw new Error('Transaction already completed');
    }

    if (transaction.status !== 'APPROVED') {
      throw new Error('Transaction must be approved before processing');
    }

    try {
      switch (transaction.type) {
        case 'RECEIVE':
          await this.processReceive(transaction);
          break;
        case 'CONSUME':
          await this.processConsume(transaction);
          break;
        case 'TRANSFER':
          await this.processTransfer(transaction);
          break;
        case 'ADJUST':
          await this.processAdjust(transaction);
          break;
        case 'DAMAGE':
        case 'DISPOSE':
          await this.processDamageOrDispose(transaction);
          break;
        case 'ASSIGN':
          await this.processAssign(transaction);
          break;
        case 'UNASSIGN':
          await this.processUnassign(transaction);
          break;
        default:
          throw new Error(`Unknown transaction type: ${transaction.type}`);
      }

      // Mark as completed
      await this.prisma.transaction.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return true;
    } catch (error) {
      // Mark as failed
      await this.prisma.transaction.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: `${transaction.notes || ''}\nProcessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });

      throw error;
    }
  }

  /**
   * Transfer inventory between locations
   */
  async transferInventory(data: TransferInventoryDTO) {
    const { itemId, quantity, fromPropertyId, fromUnitId, fromRoomId, toPropertyId, toUnitId, toRoomId, reason, notes, createdBy } = data;

    // Validate sufficient inventory at source
    const fromLevel = await this.levelService.getLevelByLocation(
      itemId,
      fromPropertyId,
      fromUnitId,
      fromRoomId
    );

    if (!fromLevel) {
      throw new Error('Source inventory level not found');
    }

    if (fromLevel.quantityAvailable < quantity) {
      throw new Error('Insufficient inventory at source location');
    }

    // Create transfer transaction
    const transaction = await this.createTransaction({
      type: 'TRANSFER',
      itemId,
      quantity,
      fromPropertyId,
      fromUnitId,
      fromRoomId,
      fromLocation: fromLevel.locationName,
      toPropertyId,
      toUnitId,
      toRoomId,
      toLocation: `${toPropertyId}${toUnitId ? `/${toUnitId}` : ''}${toRoomId ? `/${toRoomId}` : ''}`,
      reason: reason || 'Inventory transfer',
      notes,
      createdBy,
      requiresApproval: false,
    });

    return transaction;
  }

  /**
   * Receive inventory (from purchase order, vendor, etc.)
   */
  private async processReceive(transaction: any) {
    if (!transaction.toPropertyId) {
      throw new Error('Destination property required for receive transaction');
    }

    await this.levelService.adjustInventory({
      itemId: transaction.itemId,
      propertyId: transaction.toPropertyId,
      unitId: transaction.toUnitId || undefined,
      roomId: transaction.toRoomId || undefined,
      quantity: transaction.quantity,
      reason: transaction.reason || 'Inventory received',
      reasonCode: transaction.reasonCode,
      notes: transaction.notes,
    });
  }

  /**
   * Consume inventory (use items)
   */
  private async processConsume(transaction: any) {
    if (!transaction.fromPropertyId) {
      throw new Error('Source property required for consume transaction');
    }

    await this.levelService.adjustInventory({
      itemId: transaction.itemId,
      propertyId: transaction.fromPropertyId,
      unitId: transaction.fromUnitId || undefined,
      roomId: transaction.fromRoomId || undefined,
      quantity: -transaction.quantity,
      reason: transaction.reason || 'Inventory consumed',
      reasonCode: transaction.reasonCode,
      notes: transaction.notes,
    });
  }

  /**
   * Transfer inventory between locations
   */
  private async processTransfer(transaction: any) {
    if (!transaction.fromPropertyId || !transaction.toPropertyId) {
      throw new Error('Both source and destination properties required for transfer');
    }

    // Decrease from source
    await this.levelService.adjustInventory({
      itemId: transaction.itemId,
      propertyId: transaction.fromPropertyId,
      unitId: transaction.fromUnitId || undefined,
      roomId: transaction.fromRoomId || undefined,
      quantity: -transaction.quantity,
      reason: `Transfer to ${transaction.toLocation}`,
      reasonCode: transaction.reasonCode,
    });

    // Increase at destination
    await this.levelService.adjustInventory({
      itemId: transaction.itemId,
      propertyId: transaction.toPropertyId,
      unitId: transaction.toUnitId || undefined,
      roomId: transaction.toRoomId || undefined,
      quantity: transaction.quantity,
      reason: `Transfer from ${transaction.fromLocation}`,
      reasonCode: transaction.reasonCode,
    });
  }

  /**
   * Adjust inventory (manual adjustment)
   */
  private async processAdjust(transaction: any) {
    const propertyId = transaction.toPropertyId || transaction.fromPropertyId;
    const unitId = transaction.toUnitId || transaction.fromUnitId;
    const roomId = transaction.toRoomId || transaction.fromRoomId;

    if (!propertyId) {
      throw new Error('Property required for adjustment');
    }

    const quantity = transaction.toPropertyId ? transaction.quantity : -transaction.quantity;

    await this.levelService.adjustInventory({
      itemId: transaction.itemId,
      propertyId,
      unitId: unitId || undefined,
      roomId: roomId || undefined,
      quantity,
      reason: transaction.reason || 'Manual adjustment',
      reasonCode: transaction.reasonCode,
      notes: transaction.notes,
    });
  }

  /**
   * Process damage or disposal
   */
  private async processDamageOrDispose(transaction: any) {
    if (!transaction.fromPropertyId) {
      throw new Error('Source property required for damage/dispose transaction');
    }

    await this.levelService.adjustInventory({
      itemId: transaction.itemId,
      propertyId: transaction.fromPropertyId,
      unitId: transaction.fromUnitId || undefined,
      roomId: transaction.fromRoomId || undefined,
      quantity: -transaction.quantity,
      reason: transaction.reason || `Item ${transaction.type.toLowerCase()}d`,
      reasonCode: transaction.reasonCode,
      notes: transaction.notes,
    });

    // Update item condition if damage
    if (transaction.type === 'DAMAGE') {
      await this.prisma.inventoryItem.update({
        where: { id: transaction.itemId },
        data: {
          condition: 'DAMAGED',
        },
      });
    }
  }

  /**
   * Assign to staging
   */
  private async processAssign(transaction: any) {
    if (!transaction.stagingDesignId) {
      throw new Error('Staging design required for assign transaction');
    }

    // Reserve inventory
    await this.levelService.reserveInventory(
      transaction.itemId,
      transaction.fromPropertyId,
      transaction.quantity,
      transaction.fromUnitId || undefined,
      transaction.fromRoomId || undefined
    );
  }

  /**
   * Unassign from staging
   */
  private async processUnassign(transaction: any) {
    // Release reserved inventory
    await this.levelService.releaseReservedInventory(
      transaction.itemId,
      transaction.toPropertyId,
      transaction.quantity,
      transaction.toUnitId || undefined,
      transaction.toRoomId || undefined
    );
  }

  /**
   * Get transaction history for an item
   */
  async getItemTransactionHistory(itemId: string, limit = 50) {
    return this.prisma.transaction.findMany({
      where: { itemId },
      take: limit,
      orderBy: {
        transactionDate: 'desc',
      },
      include: {
        item: {
          select: {
            sku: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStatistics(startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = startDate;
      if (endDate) where.transactionDate.lte = endDate;
    }

    const [
      totalTransactions,
      byType,
      byStatus,
      totalValue,
    ] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...where,
          totalCost: { not: null },
        },
        _sum: {
          totalCost: true,
        },
      }),
    ]);

    return {
      totalTransactions,
      byType: byType.map((t) => ({
        type: t.type,
        count: t._count.id,
      })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      totalValue: totalValue._sum.totalCost || 0,
    };
  }
}
