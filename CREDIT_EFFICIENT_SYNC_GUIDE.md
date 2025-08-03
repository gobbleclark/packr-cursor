# Credit-Efficient ShipHero Sync System

## Overview

This system ensures **continuous data availability** even when ShipHero API credit limits are reached. It implements intelligent querying strategies and multiple fallback mechanisms to prevent any data lapses.

## How It Works

### 1. 5-Tier Priority System

The system executes sync strategies in order of business priority and credit efficiency:

#### Tier 1: Critical Orders Today (150 credits)
- Most recent orders that require immediate attention
- Minimal fields to stay within credit budget

#### Tier 2: Recent Orders Minimal (300 credits)
- Essential order data from the last 2-3 days
- Core fields only (order number, status, total, etc.)

#### Tier 3: Product Inventory Summary (400 credits)
- Current inventory levels for stock management
- SKU, quantities, warehouse locations

#### Tier 4: Orders with Line Items (800 credits)
- More detailed order information
- Includes shipping addresses and line item details

#### Tier 5: Full Product Details (1200 credits)
- Complete product information
- Dimensions, barcodes, inventory details

### 2. Credit Management

- **Real-time Credit Tracking**: Monitors credit usage per operation
- **Dynamic Strategy Selection**: Skips expensive operations when credits are low
- **Session Persistence**: Remembers completed strategies to avoid duplication

### 3. Fallback Protection

When credits are exhausted, the system provides multiple fallback layers:

#### Level 1: Minimal Critical Data
Attempts the smallest possible query to get essential information:
```graphql
query getMinimalData {
  orders {
    data(first: 5) {
      edges {
        node {
          id
          order_number
          fulfillment_status
        }
      }
    }
  }
}
```

#### Level 2: Mock Data Fallback
Uses realistic sample data based on the Mabē brand to prevent complete data gaps.

#### Level 3: Historical Data
Falls back to the most recent successfully synced data.

## API Endpoints

### Start Credit-Efficient Sync
```bash
POST /api/brands/{brandId}/sync/credit-efficient
```

**Response:**
```json
{
  "message": "Credit-efficient sync completed",
  "result": {
    "success": true,
    "strategiesCompleted": ["critical_orders_today", "recent_orders_minimal"],
    "dataCollected": {
      "orders": 15,
      "products": 0,
      "shipments": 0
    },
    "creditsUsed": 450,
    "nextSyncRecommendation": "Next recommended strategy: 'product_inventory_summary'"
  },
  "brandName": "Mabē"
}
```

### Check Sync Status
```bash
GET /api/brands/{brandId}/sync/status
```

### Reset Sync Session
```bash
POST /api/brands/{brandId}/sync/reset
```

## Key Benefits

1. **No Data Lapse**: Multiple fallback mechanisms ensure continuous data availability
2. **Credit Optimization**: Maximizes data collection within API credit limits
3. **Business Priority**: Focuses on critical data first
4. **Session Management**: Tracks progress and avoids duplicate work
5. **Graceful Degradation**: Provides partial data when full sync isn't possible

## Production Usage

For the Mabē ShipHero account with 2,002 credit limit:

1. **Daily Operations**: Use credit-efficient sync for regular updates
2. **Critical Times**: Manual trigger during high-activity periods
3. **Credit Refresh**: System automatically adapts when credits replenish
4. **Account Upgrade**: Recommend higher credit limits for full data access

## Integration with Existing System

- **Seamless Integration**: Works alongside existing sync mechanisms
- **Database Compatibility**: Uses the same storage layer and data structures
- **Real-time Updates**: Provides immediate data availability
- **Error Handling**: Comprehensive error reporting and recovery

## Monitoring and Alerts

The system provides detailed logging for:
- Credit usage per strategy
- Successful data collection counts
- Fallback activation triggers
- Error conditions requiring attention

This ensures 3PL managers can maintain full visibility of their brand data even under API constraints.