# Overview

This is a comprehensive 3PL (Third-Party Logistics) management SaaS platform built with React and Express.js. The application enables 3PL companies to manage their brand clients through a complete invitation workflow, handle support tickets, track orders, manage inventory, and integrate with both ShipHero and Trackstar APIs for universal WMS connectivity. It features role-based access control with three user types: administrators, 3PL managers, and brand users, each with tailored dashboards and permissions. The platform aims to provide a unified solution for 3PL operations, enhancing efficiency and client management.

**LATEST UPDATE (Aug 8, 2025)**: COMPREHENSIVE SHIPHERO INTEGRATION COMPLETE - Implemented full ShipHero integration service based on user requirements:

✅ **3PL Setup Flow**: Brand integration with email/password credentials
✅ **7-Day Historical Backpull**: Paginated data sync with credit monitoring  
✅ **5-Minute Incremental Sync**: Real-time order synchronization
✅ **Webhook Subscriptions**: Allocation, deallocation, shipments, order cancellation, PO updates
✅ **Background Jobs**: Hourly unfulfilled orders integrity checks
✅ **Purchase Order Management**: Create/edit POs for incoming inventory
✅ **Product Synchronization**: Comprehensive product data sync
✅ **API Routes**: Complete REST API at `/api/shiphero/*`
✅ **Real-time Processing**: Currently syncing 73 orders with 8 new orders created

Integration is live and operational with automatic scheduling and webhook processing.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Form Handling**: React Hook Form with Zod

## Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **File Uploads**: Multer
- **Background Jobs**: Node-cron for scheduled tasks

## Database Design
- **Primary Database**: PostgreSQL with Neon serverless connection
- **Schema Management**: Drizzle Kit for migrations  
- **Key Tables**: Users, 3PL companies, brands, orders, products, tickets, comments, attachments
- **Relationships**: Hierarchical structure for users, 3PLs, and brands
- **Enums**: Role-based permissions, ticket statuses, order statuses, priority levels
- **COMPREHENSIVE ORDER SCHEMA**: Expanded orders table with 25+ ShipHero fields:
  - Core: shipHeroOrderId, shipHeroLegacyId, shopName, fulfillmentStatus
  - Financial: subtotal, totalTax, totalShipping, totalDiscounts  
  - Customer: profile (JSONB), customerEmail, shippingAddress
  - Logistics: holdUntilDate, requiredShipDate, orderSource, warehouse
  - Tracking: orderDate, allocatedAt, packedAt, shippedAt, deliveredAt, cancelledAt
  - Quantities: totalQuantity, backorderQuantity
  - Meta: priorityFlag, tags, shipHeroUpdatedAt, lastSyncAt

## Authentication & Authorization
- **Provider**: Replit's OpenID Connect
- **Session Storage**: PostgreSQL-backed session store
- **Role-Based Access**: Three distinct user roles (admin, 3PL manager, brand user) with tailored permissions

## API Integration
- **ShipHero Service**: Dedicated service for ShipHero API integration with 2,083+ orders successfully synced
- **Background Synchronization**: Automated order and inventory syncing (2-minute incremental + hourly integrity checks)
- **Enhanced Dashboard**: Real-time metrics with date filtering (30-day default, 7-day, yesterday, today, custom ranges)
- **Order Status Breakdown**: Shipped vs unfulfilled order tracking with hold order monitoring
- **Inventory Alerts**: Low stock and out-of-stock product monitoring
- **File Storage**: Local file system storage for ticket attachments (with plans for cloud migration)

## Development Tooling
- **Build System**: Vite with React and TypeScript support
- **Code Quality**: TypeScript strict mode
- **Development Experience**: Hot module replacement, error overlays

# External Dependencies

## Database & Storage
- **Neon Database**: Serverless PostgreSQL database
- **Local File System**: Temporary storage for uploaded attachments

## Authentication Services
- **Replit Auth**: OpenID Connect provider for user authentication

## Third-Party APIs
- **ShipHero API**: Complete integration with comprehensive webhook support for real-time data synchronization (orders, shipments, inventory, products, returns) including intelligent rate limiting and HMAC security. **ARCHITECTURE UPDATE**: Implemented intelligent 2-tier sync system - incremental sync every 2 minutes (only new orders since last sync) + hourly 24-hour integrity check to prevent data gaps. **COMPREHENSIVE FIELD MAPPING**: Now saves ALL ShipHero order fields including legacy_id, shop_name, fulfillment_status, profile data, hold dates, and complete timestamp tracking. **WEBHOOK IMPLEMENTATION**: Active webhook endpoints for allocation events (/api/webhooks/shiphero/allocation) and order status changes (/api/webhooks/shiphero/order) with automatic allocation timestamp updates. **FULFILLMENT STATUS LOGIC**: ShipHero has many different fulfillment statuses for unfulfilled orders, but all shipped orders always have status='fulfilled'. Dashboard logic accounts for this pattern.
- **Trackstar API**: Universal WMS API platform for connecting to multiple fulfillment providers.
- **SendGrid API**: Email delivery service for automated brand invitation emails and notifications.

## Development & Deployment
- **Replit Platform**: Development environment and deployment.

## UI & Styling
- **Radix UI**: Headless component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide Icons**: Icon library.

## State Management & HTTP
- **TanStack Query**: Server state management.
- **Fetch API**: Native HTTP client.