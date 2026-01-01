# InventoryAI Quick Start Guide

AI-powered demand forecasting and automated reordering to reduce stockouts and optimize inventory holding costs. Get your first stock optimization running in under 5 minutes.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Nexus Platform | 1.0.0+ | Plugin runtime environment |
| Node.js | 20+ | JavaScript runtime (for SDK) |
| API Key | - | Authentication |

## Installation Methods

### Method 1: Nexus Marketplace (Recommended)

Install directly from the Nexus Marketplace with one click:

1. Navigate to **Marketplace** in your Nexus Dashboard
2. Search for "InventoryAI"
3. Click **Install** and select your pricing tier
4. The plugin activates automatically within 60 seconds

### Method 2: Nexus CLI

```bash
nexus plugin install nexus-inventory
nexus config set INVENTORY_API_KEY your-api-key-here
```

### Method 3: API Installation

```bash
curl -X POST https://api.adverant.ai/v1/plugins/install \
  -H "Authorization: Bearer YOUR_NEXUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pluginId": "nexus-inventory",
    "tier": "professional",
    "autoActivate": true
  }'
```

---

## Your First Operation: Check Stock Levels

### Step 1: Set Your API Key

```bash
export NEXUS_API_KEY="your-api-key-here"
```

### Step 2: Query Stock Levels

```bash
curl -X GET "https://api.adverant.ai/proxy/inventory/api/v1/stock" \
  -H "Authorization: Bearer $NEXUS_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSKUs": 247,
    "lowStockAlerts": 12,
    "outOfStock": 3,
    "stockValue": 145892.50,
    "lastUpdated": "2025-01-01T10:30:00Z"
  }
}
```

---

## API Reference

**Base URL:** `https://api.adverant.ai/proxy/inventory/api/v1`

### Get Stock Levels
```bash
curl -X GET "https://api.adverant.ai/proxy/inventory/api/v1/stock" \
  -H "Authorization: Bearer $NEXUS_API_KEY"
```

### Generate Demand Forecast
```bash
curl -X POST "https://api.adverant.ai/proxy/inventory/api/v1/forecast" \
  -H "Authorization: Bearer $NEXUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "skuIds": ["SKU-001", "SKU-002"],
    "forecastDays": 30,
    "includeSeasonality": true
  }'
```

### Create Reorder Recommendation
```bash
curl -X POST "https://api.adverant.ai/proxy/inventory/api/v1/reorder" \
  -H "Authorization: Bearer $NEXUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "warehouse-01",
    "optimizeFor": "cost",
    "leadTimeDays": 7
  }'
```

### Get Inventory Analytics
```bash
curl -X GET "https://api.adverant.ai/proxy/inventory/api/v1/analytics" \
  -H "Authorization: Bearer $NEXUS_API_KEY"
```

---

## SDK Examples

### TypeScript

```typescript
import { NexusClient } from '@adverant/nexus-sdk';

const nexus = new NexusClient({
  apiKey: process.env.NEXUS_API_KEY
});

const inventory = nexus.plugin('nexus-inventory');

// Check stock levels
const stock = await inventory.stock.getAll({
  locationId: 'warehouse-01',
  includeForecasts: true
});

console.log(`Low Stock Alerts: ${stock.lowStockAlerts}`);

// Generate demand forecast
const forecast = await inventory.forecast.create({
  skuIds: ['SKU-001', 'SKU-002'],
  forecastDays: 30
});

forecast.forecasts.forEach(item => {
  console.log(`${item.skuId}: ${item.predictedDemand} units`);
});
```

### Python

```python
from adverant_nexus import NexusClient
import os

nexus = NexusClient(api_key=os.environ["NEXUS_API_KEY"])
inventory = nexus.plugin("nexus-inventory")

# Check stock levels
stock = inventory.stock.get_all(
    location_id="warehouse-01",
    include_forecasts=True
)

print(f"Low Stock Alerts: {stock.low_stock_alerts}")

# Generate demand forecast
forecast = inventory.forecast.create(
    sku_ids=["SKU-001", "SKU-002"],
    forecast_days=30
)

for item in forecast.forecasts:
    print(f"{item.sku_id}: {item.predicted_demand} units")
```

---

## Pricing

| Tier | Price | SKUs | Locations | Features |
|------|-------|------|-----------|----------|
| **Starter** | $49/mo | 500 | 1 | Basic tracking, Alerts |
| **Professional** | $149/mo | 5,000 | 10 | Demand forecasting, Auto-reorder, Multi-location |
| **Enterprise** | Custom | Unlimited | Unlimited | ERP integration, Custom forecasting models |

---

## Next Steps

- [Use Cases Guide](./USE-CASES.md) - Real-world implementation scenarios
- [Architecture Overview](./ARCHITECTURE.md) - System design and integration
- [API Reference](./docs/api-reference/endpoints.md) - Complete endpoint documentation

## Support

- **Documentation**: [docs.adverant.ai/plugins/inventory](https://docs.adverant.ai/plugins/inventory)
- **Community**: [community.adverant.ai](https://community.adverant.ai)
- **Email**: plugins@adverant.ai
