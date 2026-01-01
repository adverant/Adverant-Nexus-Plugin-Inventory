# InventoryAI - Technical Documentation

## API Reference

### Base URL

```
https://api.adverant.ai/proxy/nexus-inventory/api/v1/inventory
```

### Authentication

All API requests require a Bearer token in the Authorization header:

```bash
Authorization: Bearer YOUR_API_KEY
```

#### Required Scopes

| Scope | Description |
|-------|-------------|
| `inventory:read` | Read stock levels and items |
| `inventory:write` | Create and modify inventory |
| `inventory:forecast` | Access demand forecasting |
| `inventory:reorder` | Manage reorder operations |

---

## API Endpoints

### Stock Management

#### Get Current Stock Levels

```http
GET /stock
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `location_id` | string | Filter by location |
| `category` | string | Filter by category |
| `below_reorder` | boolean | Only show items below reorder point |
| `sku` | string | Filter by SKU |
| `sort` | string | Sort by field |
| `limit` | number | Results per page |
| `offset` | number | Pagination offset |

**Response:**

```json
{
  "items": [
    {
      "item_id": "item_abc123",
      "sku": "SUPP-TOWELS-001",
      "name": "Bath Towels - White",
      "category": "linens",
      "subcategory": "bath",
      "current_stock": 24,
      "par_level": 36,
      "reorder_point": 12,
      "reorder_quantity": 24,
      "unit_cost": 8.50,
      "total_value": 204.00,
      "location": {
        "location_id": "loc_warehouse",
        "name": "Main Warehouse"
      },
      "status": "adequate",
      "last_restocked": "2025-01-10T10:00:00Z",
      "usage_rate": {
        "daily_average": 2.5,
        "weekly_average": 17.5,
        "monthly_average": 75
      },
      "days_until_stockout": 9.6
    }
  ],
  "summary": {
    "total_items": 245,
    "total_value": 15420.50,
    "items_below_reorder": 12,
    "items_out_of_stock": 3
  },
  "pagination": {
    "total": 245,
    "limit": 20,
    "offset": 0
  }
}
```

### Inventory Items

#### Add Inventory Item

```http
POST /items
```

**Request Body:**

```json
{
  "name": "King Size Mattress",
  "sku": "MATT-KING-001",
  "category": "furniture",
  "subcategory": "bedroom",
  "description": "Premium king size mattress",
  "unit_cost": 450.00,
  "supplier_id": "supp_abc123",
  "property_id": "prop_abc123",
  "location": {
    "room": "master_bedroom",
    "position": "bed_frame"
  },
  "attributes": {
    "brand": "SleepWell",
    "model": "CloudRest Pro",
    "dimensions": "76x80x12",
    "weight_lbs": 85
  },
  "lifecycle": {
    "purchase_date": "2024-06-15",
    "warranty_expiry": "2034-06-15",
    "expected_life_years": 10,
    "depreciation_method": "straight_line"
  },
  "tracking": {
    "serial_number": "SW-2024-12345",
    "barcode": "123456789012",
    "asset_tag": "ASSET-001"
  }
}
```

**Response:**

```json
{
  "item_id": "item_abc123",
  "sku": "MATT-KING-001",
  "name": "King Size Mattress",
  "status": "active",
  "current_value": 450.00,
  "depreciated_value": 450.00,
  "created_at": "2025-01-15T10:00:00Z"
}
```

#### Get Item Details

```http
GET /items/:id
```

**Response:**

```json
{
  "item_id": "item_abc123",
  "sku": "MATT-KING-001",
  "name": "King Size Mattress",
  "category": "furniture",
  "subcategory": "bedroom",
  "status": "deployed",
  "condition": "excellent",
  "property": {
    "property_id": "prop_abc123",
    "name": "Beachfront Villa"
  },
  "location": {
    "room": "master_bedroom",
    "position": "bed_frame"
  },
  "lifecycle": {
    "purchase_date": "2024-06-15",
    "purchase_price": 450.00,
    "current_value": 405.00,
    "depreciation_rate": 0.10,
    "warranty_expiry": "2034-06-15",
    "warranty_status": "active",
    "age_days": 214,
    "expected_replacement_date": "2034-06-15"
  },
  "maintenance": {
    "last_inspection": "2025-01-01",
    "next_scheduled": "2025-04-01",
    "maintenance_history": [
      {
        "date": "2025-01-01",
        "type": "inspection",
        "notes": "Mattress in excellent condition",
        "cost": 0
      }
    ]
  },
  "history": [
    {
      "event": "purchased",
      "date": "2024-06-15",
      "details": { "vendor": "SleepWell Direct", "cost": 450.00 }
    },
    {
      "event": "deployed",
      "date": "2024-06-20",
      "details": { "property": "Beachfront Villa", "room": "master_bedroom" }
    }
  ]
}
```

### Inventory Levels

#### Set Inventory Level

```http
POST /levels
```

**Request Body:**

```json
{
  "item_id": "item_toiletries_001",
  "property_id": "prop_abc123",
  "quantity": 24,
  "par_level": 36,
  "reorder_point": 12,
  "reorder_quantity": 24,
  "storage_location": "supply_closet_a",
  "expiration_date": "2025-06-15",
  "lot_number": "LOT-2024-001"
}
```

**Response:**

```json
{
  "level_id": "level_xyz789",
  "item_id": "item_toiletries_001",
  "property_id": "prop_abc123",
  "quantity": 24,
  "par_level": 36,
  "reorder_point": 12,
  "status": "adequate",
  "days_until_reorder": 4.8,
  "updated_at": "2025-01-15T10:00:00Z"
}
```

#### Get Inventory Levels

```http
GET /levels
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `property_id` | string | Filter by property |
| `category` | string | Filter by category |
| `status` | string | `adequate`, `low`, `critical`, `out_of_stock` |

### Demand Forecasting

#### Generate Demand Forecast

```http
POST /forecast
```

**Request Body:**

```json
{
  "items": ["item_001", "item_002", "item_003"],
  "property_id": "prop_abc123",
  "forecast_period_days": 30,
  "include_seasonality": true,
  "include_events": true,
  "events": [
    {
      "date": "2025-02-14",
      "type": "holiday",
      "name": "Valentine's Day",
      "expected_impact": 1.5
    }
  ]
}
```

**Response:**

```json
{
  "forecast_id": "fcst_abc123",
  "property_id": "prop_abc123",
  "period": {
    "start": "2025-01-15",
    "end": "2025-02-14"
  },
  "forecasts": [
    {
      "item_id": "item_001",
      "sku": "SUPP-TOWELS-001",
      "name": "Bath Towels - White",
      "current_stock": 24,
      "predicted_usage": 75,
      "confidence_interval": {
        "low": 65,
        "high": 85
      },
      "recommended_order": {
        "quantity": 51,
        "order_date": "2025-01-20",
        "expected_delivery": "2025-01-25"
      },
      "stockout_risk": {
        "probability": 0.15,
        "expected_date": "2025-01-25"
      },
      "seasonality_factor": 1.2,
      "trend": "increasing"
    }
  ],
  "summary": {
    "total_items_forecasted": 3,
    "items_needing_reorder": 2,
    "estimated_order_value": 425.00
  },
  "generated_at": "2025-01-15T10:00:00Z"
}
```

### Reorder Management

#### Create Reorder Recommendation

```http
POST /reorder
```

**Request Body:**

```json
{
  "property_id": "prop_abc123",
  "strategy": "just_in_time | safety_stock | economic_order_quantity",
  "include_pending_orders": true,
  "consolidate_suppliers": true
}
```

**Response:**

```json
{
  "recommendation_id": "rec_abc123",
  "property_id": "prop_abc123",
  "strategy": "economic_order_quantity",
  "orders": [
    {
      "supplier_id": "supp_001",
      "supplier_name": "CleanPro Supplies",
      "items": [
        {
          "item_id": "item_001",
          "sku": "SUPP-TOWELS-001",
          "name": "Bath Towels - White",
          "quantity": 48,
          "unit_cost": 8.50,
          "total_cost": 408.00,
          "urgency": "medium"
        },
        {
          "item_id": "item_002",
          "sku": "SUPP-SOAP-001",
          "name": "Hand Soap",
          "quantity": 100,
          "unit_cost": 2.25,
          "total_cost": 225.00,
          "urgency": "high"
        }
      ],
      "subtotal": 633.00,
      "shipping_estimate": 25.00,
      "total": 658.00,
      "minimum_order_met": true
    }
  ],
  "summary": {
    "total_items": 2,
    "total_cost": 658.00,
    "suppliers_count": 1,
    "estimated_delivery": "2025-01-22"
  },
  "generated_at": "2025-01-15T10:00:00Z"
}
```

### Transactions

#### Record Transaction

```http
POST /transactions
```

**Request Body:**

```json
{
  "type": "receipt | usage | transfer | adjustment | write_off",
  "item_id": "item_abc123",
  "property_id": "prop_abc123",
  "quantity": 24,
  "unit_cost": 8.50,
  "reference": {
    "type": "purchase_order",
    "number": "PO-2025-001"
  },
  "notes": "Restocking from weekly order",
  "lot_number": "LOT-2025-001",
  "expiration_date": "2025-12-31"
}
```

### Staging & Furniture Moves

#### Schedule Furniture Move

```http
POST /staging/moves
```

**Request Body:**

```json
{
  "items": ["item_sofa_001", "item_table_001", "item_lamp_001"],
  "from_location": {
    "type": "warehouse",
    "location_id": "loc_warehouse"
  },
  "to_location": {
    "type": "property",
    "property_id": "prop_abc123",
    "rooms": {
      "item_sofa_001": "living_room",
      "item_table_001": "living_room",
      "item_lamp_001": "master_bedroom"
    }
  },
  "scheduled_date": "2025-02-01",
  "scheduled_time": "09:00",
  "movers_required": 2,
  "special_instructions": "Handle sofa with care - leather",
  "staging_style": "modern_coastal"
}
```

**Response:**

```json
{
  "move_id": "move_abc123",
  "status": "scheduled",
  "items_count": 3,
  "from": "Main Warehouse",
  "to": "Beachfront Villa",
  "scheduled": "2025-02-01T09:00:00Z",
  "estimated_duration_hours": 2,
  "estimated_cost": 150.00
}
```

### Analytics

#### Get Inventory Analytics

```http
GET /analytics
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | string | Start of date range |
| `end_date` | string | End of date range |
| `property_id` | string | Filter by property |
| `category` | string | Filter by category |
| `metrics` | string[] | Specific metrics to include |

**Response:**

```json
{
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "summary": {
    "total_inventory_value": 125000.00,
    "total_items": 1250,
    "turnover_rate": 4.2,
    "stockout_incidents": 3,
    "waste_value": 150.00
  },
  "by_category": [
    {
      "category": "linens",
      "value": 8500.00,
      "items_count": 450,
      "turnover_rate": 8.5,
      "usage_trend": "stable"
    },
    {
      "category": "furniture",
      "value": 85000.00,
      "items_count": 120,
      "depreciation_this_period": 850.00
    }
  ],
  "cost_analysis": {
    "total_purchases": 12500.00,
    "carrying_cost": 625.00,
    "stockout_cost_estimated": 450.00,
    "waste_and_damage": 150.00
  },
  "top_consumed_items": [
    { "item": "Toilet Paper", "quantity": 500, "value": 250.00 },
    { "item": "Hand Soap", "quantity": 300, "value": 675.00 }
  ],
  "reorder_efficiency": {
    "on_time_orders": 95,
    "late_orders": 5,
    "average_lead_time_days": 3.2
  }
}
```

---

## Rate Limits

| Tier | Stock/min | Forecasts/hour | Transactions/min |
|------|-----------|----------------|------------------|
| Starter | 30 | 5 | 50 |
| Professional | 100 | 20 | 200 |
| Enterprise | 500 | 100 | Unlimited |

---

## Data Models

### InventoryItem

```typescript
interface InventoryItem {
  item_id: string;
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  item_type: 'consumable' | 'asset' | 'equipment';
  status: 'active' | 'inactive' | 'discontinued';
  condition?: 'new' | 'excellent' | 'good' | 'fair' | 'poor';
  unit_cost: number;
  supplier_id?: string;
  property_id?: string;
  location?: ItemLocation;
  attributes: Record<string, unknown>;
  lifecycle?: AssetLifecycle;
  tracking?: ItemTracking;
  created_at: string;
  updated_at: string;
}

interface ItemLocation {
  location_id?: string;
  room?: string;
  position?: string;
  coordinates?: { x: number; y: number };
}

interface AssetLifecycle {
  purchase_date: string;
  purchase_price: number;
  warranty_expiry?: string;
  expected_life_years: number;
  depreciation_method: 'straight_line' | 'declining_balance' | 'none';
  current_value: number;
  salvage_value?: number;
}

interface ItemTracking {
  serial_number?: string;
  barcode?: string;
  asset_tag?: string;
  rfid_tag?: string;
}
```

### StockLevel

```typescript
interface StockLevel {
  level_id: string;
  item_id: string;
  property_id: string;
  quantity: number;
  par_level: number;
  reorder_point: number;
  reorder_quantity: number;
  status: 'adequate' | 'low' | 'critical' | 'out_of_stock';
  storage_location?: string;
  expiration_date?: string;
  lot_number?: string;
  days_until_stockout?: number;
  days_until_reorder?: number;
  updated_at: string;
}
```

### Transaction

```typescript
interface InventoryTransaction {
  transaction_id: string;
  type: 'receipt' | 'usage' | 'transfer' | 'adjustment' | 'write_off';
  item_id: string;
  property_id: string;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reference?: TransactionReference;
  from_location?: string;
  to_location?: string;
  notes?: string;
  lot_number?: string;
  performed_by: string;
  created_at: string;
}

interface TransactionReference {
  type: 'purchase_order' | 'work_order' | 'reservation' | 'manual';
  number: string;
}
```

---

## SDK Integration

### JavaScript/TypeScript

```typescript
import { NexusClient } from '@adverant/nexus-sdk';

const client = new NexusClient({
  apiKey: process.env.NEXUS_API_KEY
});

// Get stock levels
const stock = await client.inventory.stock({
  property_id: 'prop_abc123',
  below_reorder: true
});

console.log(`${stock.summary.items_below_reorder} items need reordering`);

// Generate demand forecast
const forecast = await client.inventory.forecast({
  items: ['item_001', 'item_002'],
  property_id: 'prop_abc123',
  forecast_period_days: 30,
  include_seasonality: true
});

// Create reorder recommendation
const reorder = await client.inventory.reorder({
  property_id: 'prop_abc123',
  strategy: 'economic_order_quantity'
});

console.log(`Total order value: $${reorder.summary.total_cost}`);

// Record transaction
await client.inventory.transactions.create({
  type: 'receipt',
  item_id: 'item_abc123',
  property_id: 'prop_abc123',
  quantity: 24,
  unit_cost: 8.50
});
```

### Python

```python
from nexus_sdk import NexusClient

client = NexusClient(api_key=os.environ["NEXUS_API_KEY"])

# Add inventory item
item = client.inventory.items.create(
    name="Bath Towels - White",
    sku="SUPP-TOWELS-001",
    category="linens",
    unit_cost=8.50,
    property_id="prop_abc123"
)

# Set stock level
level = client.inventory.levels.set(
    item_id=item["item_id"],
    property_id="prop_abc123",
    quantity=24,
    par_level=36,
    reorder_point=12
)

# Get forecast
forecast = client.inventory.forecast(
    items=[item["item_id"]],
    property_id="prop_abc123",
    forecast_period_days=30
)

for f in forecast["forecasts"]:
    print(f"{f['name']}: {f['predicted_usage']} units predicted")
    if f['stockout_risk']['probability'] > 0.1:
        print(f"  Warning: {f['stockout_risk']['probability']*100:.0f}% stockout risk")
```

---

## Webhook Events

| Event | Description |
|-------|-------------|
| `stock.low` | Stock fell below reorder point |
| `stock.critical` | Stock at critical level |
| `stock.out` | Item out of stock |
| `stock.restocked` | Item restocked |
| `forecast.generated` | Forecast completed |
| `reorder.recommended` | Reorder recommendation ready |
| `asset.warranty_expiring` | Asset warranty expiring soon |
| `asset.maintenance_due` | Maintenance scheduled |

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `ITEM_NOT_FOUND` | 404 | Item does not exist |
| `LEVEL_NOT_FOUND` | 404 | Stock level not found |
| `INSUFFICIENT_STOCK` | 400 | Not enough stock for operation |
| `SKU_EXISTS` | 400 | SKU already in use |
| `FORECAST_FAILED` | 500 | Forecasting engine error |
| `LOCATION_LIMIT_EXCEEDED` | 402 | Location limit for tier exceeded |

---

## Deployment Requirements

### Container Specifications

| Resource | Value |
|----------|-------|
| CPU | 1000m (1 core) |
| Memory | 2048 MB |
| Disk | 10 GB |
| Timeout | 300,000 ms (5 min) |
| Max Concurrent Jobs | 10 |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis for caching |
| `MAGEAGENT_URL` | Yes | MageAgent for forecasting |
| `STORAGE_BUCKET` | Yes | Cloud storage for images |

### Health Checks

| Endpoint | Purpose |
|----------|---------|
| `/health` | General health check |
| `/ready` | Readiness probe |
| `/live` | Liveness probe |

---

## Quotas and Limits

### By Pricing Tier

| Limit | Starter | Professional | Enterprise |
|-------|---------|--------------|------------|
| SKUs | 500 | 5,000 | Unlimited |
| Locations | 1 | 10 | Unlimited |
| Transactions/month | 1,000 | 10,000 | Unlimited |
| Forecasts/month | 10 | 100 | Unlimited |
| Demand Forecasting | - | Yes | Custom Models |
| Auto Reorder | - | Yes | Yes |
| ERP Integration | - | - | Yes |

### Pricing

| Tier | Monthly |
|------|---------|
| Starter | $49 |
| Professional | $149 |
| Enterprise | Custom |

---

## Support

- **Documentation**: [docs.adverant.ai/plugins/inventory](https://docs.adverant.ai/plugins/inventory)
- **Discord**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email**: support@adverant.ai
