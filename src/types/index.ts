import {
  ItemCategory,
  ItemCondition,
  TransactionType,
  TransactionStatus,
  StockAlertLevel,
  StagingStatus
} from '@prisma/client';

// ============================================================================
// INVENTORY ITEM TYPES
// ============================================================================

export interface CreateInventoryItemDTO {
  sku: string;
  name: string;
  description?: string;
  category: ItemCategory;
  subcategory?: string;
  brand?: string;
  model?: string;
  manufacturer?: string;
  barcode?: string;
  qrCode?: string;
  serialNumber?: string;
  purchaseCost: number;
  replacementCost: number;
  currentValue?: number;
  expectedLifespan?: number;
  warrantyMonths?: number;
  condition?: ItemCondition;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  color?: string;
  material?: string;
  photos?: string[];
  documents?: string[];
  notes?: string;
  vendorId?: string;
  vendorName?: string;
  vendorSku?: string;
  vendorContact?: any;
  reorderPoint?: number;
  reorderQuantity?: number;
  maxQuantity?: number;
  tags?: string[];
  customFields?: any;
}

export interface UpdateInventoryItemDTO extends Partial<CreateInventoryItemDTO> {
  isActive?: boolean;
}

export interface ListInventoryItemsQuery {
  page?: number;
  limit?: number;
  category?: ItemCategory;
  condition?: ItemCondition;
  search?: string;
  vendorId?: string;
  isActive?: boolean;
  lowStock?: boolean;
}

// ============================================================================
// INVENTORY LEVEL TYPES
// ============================================================================

export interface CreateInventoryLevelDTO {
  itemId: string;
  propertyId: string;
  unitId?: string;
  roomId?: string;
  locationName: string;
  quantityOnHand?: number;
  minQuantity?: number;
  maxQuantity?: number;
  reorderPoint?: number;
  binLocation?: string;
  shelfLocation?: string;
  notes?: string;
}

export interface UpdateInventoryLevelDTO extends Partial<CreateInventoryLevelDTO> {
  quantityOnHand?: number;
  quantityReserved?: number;
}

export interface AdjustInventoryDTO {
  itemId: string;
  propertyId: string;
  unitId?: string;
  roomId?: string;
  quantity: number; // Positive for increase, negative for decrease
  reason?: string;
  reasonCode?: string;
  notes?: string;
  createdBy?: string;
}

export interface ListInventoryLevelsQuery {
  page?: number;
  limit?: number;
  itemId?: string;
  propertyId?: string;
  unitId?: string;
  alertLevel?: StockAlertLevel;
  lowStock?: boolean;
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export interface CreateTransactionDTO {
  type: TransactionType;
  itemId: string;
  quantity: number;
  unitCost?: number;
  fromPropertyId?: string;
  fromUnitId?: string;
  fromRoomId?: string;
  fromLocation?: string;
  toPropertyId?: string;
  toUnitId?: string;
  toRoomId?: string;
  toLocation?: string;
  reasonCode?: string;
  reason?: string;
  notes?: string;
  referenceType?: string;
  referenceNumber?: string;
  attachments?: string[];
  requiresApproval?: boolean;
  stagingDesignId?: string;
  createdBy?: string;
}

export interface ApproveTransactionDTO {
  approvedBy: string;
  notes?: string;
}

export interface RejectTransactionDTO {
  rejectionReason: string;
  rejectedBy: string;
}

export interface TransferInventoryDTO {
  itemId: string;
  quantity: number;
  fromPropertyId: string;
  fromUnitId?: string;
  fromRoomId?: string;
  toPropertyId: string;
  toUnitId?: string;
  toRoomId?: string;
  reason?: string;
  notes?: string;
  createdBy?: string;
}

export interface ListTransactionsQuery {
  page?: number;
  limit?: number;
  type?: TransactionType;
  status?: TransactionStatus;
  itemId?: string;
  propertyId?: string; // Either from or to
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// STAGING TYPES
// ============================================================================

export interface CreateStagingDesignDTO {
  name: string;
  description?: string;
  propertyId: string;
  unitId?: string;
  roomName: string;
  roomType?: string;
  style?: string;
  colorScheme?: {
    primary: string;
    secondary?: string;
    accent?: string;
  };
  theme?: string;
  targetAudience?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
  inspirationPhotos?: string[];
  floorPlan?: string;
  laborCost?: number;
  avgNightlyRateBefore?: number;
  avgNightlyRateAfter?: number;
  bookingRateBefore?: number;
  bookingRateAfter?: number;
  avgReviewScoreBefore?: number;
  avgReviewScoreAfter?: number;
  tags?: string[];
  notes?: string;
  createdBy?: string;
}

export interface UpdateStagingDesignDTO extends Partial<CreateStagingDesignDTO> {
  status?: StagingStatus;
  implementedDate?: Date;
  removedDate?: Date;
}

export interface AddStagingItemDTO {
  stagingDesignId: string;
  itemId: string;
  quantity: number;
  placement?: string;
  notes?: string;
}

export interface UpdateStagingItemDTO {
  quantity?: number;
  placement?: string;
  notes?: string;
  isPlaced?: boolean;
}

export interface ListStagingDesignsQuery {
  page?: number;
  limit?: number;
  propertyId?: string;
  unitId?: string;
  status?: StagingStatus;
  roomType?: string;
  style?: string;
}

export interface CalculateROIParams {
  costTotal: number;
  avgNightlyRateBefore: number;
  avgNightlyRateAfter: number;
  bookingRateBefore: number;
  bookingRateAfter: number;
  monthsSinceImplementation: number;
}

// ============================================================================
// FORECASTING TYPES
// ============================================================================

export interface ForecastDemandDTO {
  itemId: string;
  propertyId?: string;
  periodDays?: number;
}

export interface DemandForecastResult {
  itemId: string;
  propertyId?: string;
  forecasts: Array<{
    date: string;
    predictedDemand: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }>;
  recommendedOrder?: number;
  safetyStock?: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// LOW STOCK ALERT TYPES
// ============================================================================

export interface LowStockAlert {
  itemId: string;
  itemName: string;
  sku: string;
  propertyId: string;
  locationName: string;
  currentQuantity: number;
  reorderPoint: number;
  alertLevel: StockAlertLevel;
  recommendedOrder: number;
}

// ============================================================================
// BATCH OPERATION TYPES
// ============================================================================

export interface BatchAdjustmentDTO {
  adjustments: Array<{
    itemId: string;
    propertyId: string;
    unitId?: string;
    roomId?: string;
    quantity: number;
    reason?: string;
  }>;
  createdBy?: string;
}

export interface BatchTransferDTO {
  transfers: Array<{
    itemId: string;
    quantity: number;
    fromPropertyId: string;
    fromUnitId?: string;
    fromRoomId?: string;
    toPropertyId: string;
    toUnitId?: string;
    toRoomId?: string;
  }>;
  reason?: string;
  createdBy?: string;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface InventoryAnalytics {
  totalValue: number;
  totalItems: number;
  lowStockItems: number;
  overstockItems: number;
  categoryBreakdown: Array<{
    category: ItemCategory;
    count: number;
    value: number;
  }>;
  locationBreakdown: Array<{
    propertyId: string;
    itemCount: number;
    totalValue: number;
  }>;
}

export interface UsageTrends {
  itemId: string;
  itemName: string;
  period: string;
  totalConsumed: number;
  averageDaily: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  forecastedNextMonth: number;
}
