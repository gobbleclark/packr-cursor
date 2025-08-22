# Trackstar Integration for Packr

This document describes the Trackstar integration implementation for Packr, a multi-tenant 3PL application.

## Overview

The Trackstar integration allows 3PLs to connect their brands' WMS (Warehouse Management Systems) through Trackstar's unified API. This provides automatic synchronization of:

- **Orders** - Customer orders with status tracking
- **Products** - Product catalog with SKUs, descriptions, and metadata
- **Inventory** - Real-time stock levels and locations
- **Shipments** - Shipping information and tracking numbers

## Architecture

### Backend Components

1. **TrackstarClient** (`apps/api/src/integrations/trackstar/client.ts`)
   - HTTP client for Trackstar API with rate limiting (10 req/sec per token)
   - Pagination support with `next_token` handling
   - Automatic retry on 429 responses with `x-rate-limit-retry-after`

2. **TrackstarIntegrationService** (`apps/api/src/integrations/trackstar/service.ts`)
   - Manages integration lifecycle (connect, sync, disconnect)
   - Handles data synchronization and webhook processing
   - Uses BullMQ queues for background job processing

3. **PeriodicSyncService** (`apps/api/src/services/periodicSync.ts`)
   - Runs incremental sync every 5 minutes
   - Respects rate limits and sync intervals
   - Automatically handles multiple brands

4. **API Routes** (`apps/api/src/routes/trackstar.ts`)
   - RESTful endpoints for integration management
   - Webhook receiver with Svix signature verification
   - Admin endpoints for manual sync and health monitoring

### Frontend Components

1. **TrackstarIntegration** (`apps/web/src/components/integrations/TrackstarIntegration.tsx`)
   - Integration management UI
   - Trackstar Link button for WMS connection
   - Real-time status and health monitoring
   - Manual sync controls

## Database Schema

### New Models

```prisma
model BrandIntegration {
  id                String   @id @default(cuid())
  brandId           String
  provider          IntegrationProvider @default(TRACKSTAR)
  status            IntegrationStatus @default(PENDING)
  accessToken       String
  connectionId      String
  integrationName   String
  availableActions  Json     @default("[]")
  lastSyncedAt      DateTime?
  lastWebhookAt     DateTime?
  config            Json     @default("{}")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  brand             Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  
  @@unique([brandId, provider])
}

model TrackstarWebhookEvent {
  id              String   @id @default(cuid())
  provider        String   @default("trackstar")
  eventType       String
  connectionId    String
  integrationName String
  deliveryId      String   @unique
  signatureValid  Boolean  @default(false)
  payload         Json
  processedAt     DateTime?
  status          WebhookEventStatus @default(PENDING)
  error           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Updated Models

- **Product**: Added `externalId`, `rawData`, `updatedAtRemote`
- **Order**: Added `externalId`, `rawData`, `updatedAtRemote`
- **Shipment**: Added `externalId`, `rawData`, `service`
- **InventorySnapshot**: Added `productId` relation, `quantityFulfillable`, `quantityOnHand`

## API Endpoints

### Integration Management

- `POST /api/brands/:brandId/integrations/trackstar/link-token`
  - Creates Trackstar Link token for WMS connection
  - Requires 3PL admin role

- `POST /api/brands/:brandId/integrations/trackstar/exchange`
  - Exchanges auth code for access token
  - Stores integration details and triggers initial backfill

- `GET /api/brands/:brandId/integrations/trackstar`
  - Retrieves integration details and status

- `DELETE /api/brands/:brandId/integrations/trackstar`
  - Disconnects integration and stops synchronization

### Sync Management

- `POST /api/brands/:brandId/integrations/trackstar/sync`
  - Triggers manual sync for specified functions
  - Functions: `get_orders`, `get_products`, `get_inventory`, `get_shipments`

- `GET /api/brands/:brandId/integrations/trackstar/health`
  - Returns integration health status
  - Includes queue status and recent webhook events

### Webhooks

- `POST /api/webhooks/trackstar`
  - Receives Trackstar webhook events
  - Verifies signatures using Svix
  - Enqueues webhook processing jobs

## Data Flow

### 1. Initial Connection

1. 3PL admin clicks "Connect WMS via Trackstar" button
2. System creates link token via Trackstar API
3. Trackstar Link opens in new window
4. User completes WMS connection
5. Trackstar returns auth code
6. System exchanges auth code for access token
7. Integration is stored and initial backfill begins

### 2. Data Synchronization

#### Initial Backfill
- Pulls last 30 days of data for all resources
- Uses pagination to handle large datasets
- Stores complete raw responses in `rawData` fields
- Normalizes key fields for dashboard display

#### Incremental Sync
- Runs every 5 minutes for active integrations
- Uses `updated_date[gte]` filters to get recent changes
- 2-minute overlap window to handle clock skew
- Respects rate limits (10 req/sec per token)

### 3. Webhook Processing

1. Trackstar sends webhook for real-time events
2. System verifies signature using Svix
3. Webhook is stored in database
4. Processing job is enqueued
5. Data is updated based on event type
6. Integration status is updated

## Rate Limiting & Performance

### Trackstar API Limits
- **Rate**: 10 requests per second per access token
- **Headers**: `x-rate-limit-*` for monitoring
- **429 Response**: Includes `x-rate-limit-retry-after` header

### Implementation
- Per-token rate limiting in TrackstarClient
- Automatic retry with exponential backoff
- Queue-based job processing to handle bursts
- Pagination support for large datasets

## Security

### Multi-tenancy
- Each 3PL can only access their own brands' data
- Integration tokens are scoped to specific brands
- Database queries include `threeplId` filters

### Webhook Security
- Svix signature verification for all webhooks
- Delivery ID tracking for idempotency
- Signature validation before processing

### Data Isolation
- All data includes `brandId` and `threeplId`
- Unique constraints prevent cross-brand data mixing
- Authentication middleware enforces access control

## Monitoring & Health

### Health Metrics
- Last sync timestamp per resource type
- Queue status (waiting, processing, completed)
- Recent webhook events and their status
- Integration connection status

### Error Handling
- Automatic retry with exponential backoff
- Integration status tracking (ACTIVE, ERROR, PENDING)
- Detailed error logging and monitoring
- Graceful degradation on API failures

## Configuration

### Environment Variables

```bash
# Trackstar API
TRACKSTAR_API_KEY=f9bc96aa7e0145b899b713d83a61ad3d
TRACKSTAR_BASE_URL=https://production.trackstarhq.com

# Webhook Security
WEBHOOK_TRACKSTAR_SECRET=whsec_your_svix_secret

# Redis (for queues)
REDIS_URL=redis://localhost:6379

# Frontend
NEXT_PUBLIC_HAS_TRACKSTAR_LINK=true
```

### Trackstar Dashboard Setup

1. Create webhook endpoint in Trackstar dashboard
2. Set webhook URL to: `https://yourdomain.com/api/webhooks/trackstar`
3. Copy Svix secret to `WEBHOOK_TRACKSTAR_SECRET`
4. Configure event types: `order.*`, `product.*`, `inventory.*`, `connection.*`

## Usage Examples

### Connecting a WMS

```typescript
// 1. Create link token
const response = await fetch('/api/brands/brand123/integrations/trackstar/link-token', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' }
});

// 2. Open Trackstar Link
const { linkToken } = await response.json();
window.open(`https://link.trackstarhq.com?link_token=${linkToken}`);

// 3. Exchange auth code (after user completes connection)
await fetch('/api/brands/brand123/integrations/trackstar/exchange', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  body: JSON.stringify({ authCode: 'code_from_trackstar' })
});
```

### Manual Sync

```typescript
// Trigger manual sync for orders
await fetch('/api/brands/brand123/integrations/trackstar/sync', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  body: JSON.stringify({ functionsToSync: ['get_orders'] })
});
```

### Health Check

```typescript
// Get integration health
const health = await fetch('/api/brands/brand123/integrations/trackstar/health', {
  headers: { 'Authorization': 'Bearer token' }
});
```

## Troubleshooting

### Common Issues

1. **Rate Limiting**
   - Check logs for 429 responses
   - Verify rate limiter configuration
   - Monitor queue backlogs

2. **Webhook Failures**
   - Verify Svix secret configuration
   - Check webhook endpoint accessibility
   - Monitor signature validation logs

3. **Sync Failures**
   - Check integration status
   - Verify access token validity
   - Monitor queue job failures

4. **Data Inconsistencies**
   - Check last sync timestamps
   - Verify incremental sync is running
   - Review webhook processing logs

### Debug Endpoints

- `/health` - Server health status
- `/api/brands/:brandId/integrations/trackstar/health` - Integration health
- Queue monitoring via BullMQ dashboard (if configured)

## Development

### Local Setup

1. Install dependencies: `npm install`
2. Set up Redis: `docker run -d -p 6379:6379 redis:alpine`
3. Configure environment variables
4. Start development server: `npm run dev`

### Testing

- Unit tests for service methods
- Integration tests for API endpoints
- Webhook signature verification tests
- Rate limiting and retry logic tests

### Deployment

1. Ensure Redis is available in production
2. Configure webhook endpoint in Trackstar dashboard
3. Set production environment variables
4. Monitor queue performance and error rates

## Future Enhancements

- **Real-time Updates**: WebSocket support for live data updates
- **Advanced Filtering**: Custom sync filters per brand
- **Data Analytics**: Sync performance metrics and insights
- **Bulk Operations**: Batch processing for large datasets
- **Integration Templates**: Pre-configured WMS integrations
- **Audit Logging**: Detailed tracking of all data changes
