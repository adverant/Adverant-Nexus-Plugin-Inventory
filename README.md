<p align="center">
  <img src="assets/icon.png" alt="Inventory Logo" width="120" height="120">
</p>

<h1 align="center">Inventory</h1>

<p align="center">
  <strong>Smart Asset & Inventory Management</strong>
</p>

<p align="center">
  <a href="https://github.com/adverant/Adverant-Nexus-Plugin-Inventory/actions"><img src="https://github.com/adverant/Adverant-Nexus-Plugin-Inventory/workflows/CI/badge.svg" alt="CI Status"></a>
  <a href="https://github.com/adverant/Adverant-Nexus-Plugin-Inventory/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
  <a href="https://marketplace.adverant.ai/plugins/inventory"><img src="https://img.shields.io/badge/Nexus-Marketplace-purple.svg" alt="Nexus Marketplace"></a>
  <a href="https://discord.gg/adverant"><img src="https://img.shields.io/discord/123456789?color=7289da&label=Discord" alt="Discord"></a>
</p>

<p align="center">
  <a href="#features">Features</a> -
  <a href="#quick-start">Quick Start</a> -
  <a href="#use-cases">Use Cases</a> -
  <a href="#pricing">Pricing</a> -
  <a href="#documentation">Documentation</a>
</p>

---

## Know What You Have, Where It Is

**Inventory** is a Nexus Marketplace plugin that provides comprehensive asset and inventory management for property operations. From furniture tracking to consumable supplies, manage everything across all your properties with intelligent forecasting and automated procurement.

### Why Inventory?

- **Complete Asset Registry**: Track every piece of furniture, appliance, and equipment
- **Smart Restocking**: AI-powered forecasting predicts when supplies need reordering
- **Multi-Property Management**: Centralized inventory view across all locations
- **Staging Coordination**: Manage furniture and decor staging across properties
- **Maintenance Scheduling**: Track warranty expiration and maintenance schedules

---

## Features

### Asset Tracking

| Feature | Description |
|---------|-------------|
| **Asset Registry** | Complete database of all property assets with photos and specifications |
| **QR/Barcode Scanning** | Quick asset lookup and inventory counts via mobile scanning |
| **Location Tracking** | Know which property, room, and position each asset occupies |
| **Lifecycle Management** | Track purchase date, warranty, depreciation, and replacement schedule |

### Consumable Inventory

| Feature | Description |
|---------|-------------|
| **Stock Levels** | Real-time visibility into consumable inventory at each property |
| **Usage Tracking** | Monitor consumption rates for toiletries, cleaning supplies, and amenities |
| **Reorder Points** | Automated alerts when stock falls below threshold |
| **Par Levels** | Set optimal stock levels based on occupancy and turnover rate |

### Staging & Furniture

| Feature | Description |
|---------|-------------|
| **Staging Inventory** | Track furniture and decor available for staging |
| **Move Coordination** | Schedule and track furniture moves between properties |
| **Style Matching** | Group items by design style for cohesive staging |
| **Warehouse Management** | Track items in storage vs. deployed at properties |

---

## Quick Start

### Installation

```bash
nexus plugin install nexus-inventory
```

### Add an Inventory Item

```bash
curl -X POST "https://api.adverant.ai/proxy/nexus-inventory/api/v1/items" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "King Size Mattress",
    "category": "furniture",
    "subcategory": "bedroom",
    "sku": "MATT-KING-001",
    "propertyId": "prop_abc123",
    "location": {
      "room": "master_bedroom",
      "position": "bed_frame"
    }
  }'
```

### Track Inventory Levels

```bash
curl -X POST "https://api.adverant.ai/proxy/nexus-inventory/api/v1/levels" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "item_toiletries_001",
    "propertyId": "prop_abc123",
    "quantity": 24,
    "parLevel": 36,
    "reorderPoint": 12
  }'
```

---

## Use Cases

### Vacation Rental Operators

#### 1. Never Run Out of Supplies
AI-powered forecasting ensures you always have the right amount of toiletries, cleaning supplies, and amenities at each property.

#### 2. Asset Protection
Track every piece of furniture, appliance, and fixture. Know exactly what is in each property and its current condition.

### Staging Companies

#### 3. Furniture Fleet Management
Track furniture and decor across warehouse storage and deployed properties. Coordinate moves and maintain utilization records.

---

## Pricing

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| **Price** | $29/mo | $79/mo | $249/mo |
| **Properties** | Up to 10 | Up to 50 | Unlimited |
| **Items** | 500 | 5,000 | Unlimited |
| **Transactions/month** | 1,000 | 10,000 | Unlimited |
| **Barcode Scanning** | Yes | Yes | Yes |

[View on Nexus Marketplace](https://marketplace.adverant.ai/plugins/inventory)

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/items` | Add inventory item |
| `GET` | `/items` | List inventory items |
| `GET` | `/items/:id` | Get item details |
| `POST` | `/levels` | Set inventory level |
| `GET` | `/levels` | Get inventory levels |
| `POST` | `/transactions` | Record transaction |
| `POST` | `/staging/moves` | Schedule furniture move |
| `GET` | `/forecasts` | Get demand forecasts |

Full API documentation: [docs/api-reference/endpoints.md](docs/api-reference/endpoints.md)

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/adverant/Adverant-Nexus-Plugin-Inventory.git
cd Adverant-Nexus-Plugin-Inventory
npm install
npm run prisma:generate
npm run dev
```

---

## Community & Support

- **Documentation**: [docs.adverant.ai/plugins/inventory](https://docs.adverant.ai/plugins/inventory)
- **Discord**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email**: support@adverant.ai

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with care by <a href="https://adverant.ai">Adverant</a></strong>
</p>
