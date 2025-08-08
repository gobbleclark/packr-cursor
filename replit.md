# Overview

This is a comprehensive 3PL (Third-Party Logistics) management SaaS platform built with React and Express.js. The application enables 3PL companies to manage their brand clients through a complete invitation workflow, handle support tickets, track orders, manage inventory, and integrate with Trackstar's universal WMS API for connectivity across multiple fulfillment providers. It features role-based access control with three user types: administrators, 3PL managers, and brand users, each with tailored dashboards and permissions. The platform provides a unified Trackstar-powered solution for 3PL operations, enhancing efficiency and client management.

**LATEST UPDATE (Aug 8, 2025 - 3:54 AM)**: CLEAN SLATE TRACKSTAR SYSTEM COMPLETE - Pure Trackstar-only architecture:

🔥 **CLEAN SLATE COMPLETE**: All ShipHero data erased, fresh Trackstar-only system deployed
🆕 **TRACKSTAR-FIRST**: 100% Trackstar universal WMS integration with 44+ webhook events
🛑 **SHIPHERO REMOVED**: All ShipHero references eliminated from UI and backend
🎯 **UNIVERSAL API**: Single API key (269fcaf8b50a4fb4b384724f3e5d76db) for all brands
📱 **UI UPDATED**: Brand management and integrations pages show only Trackstar options
🔗 **WEBHOOK READY**: Complete webhook system covering order, inventory, product, receiving, returns

**COMPREHENSIVE SHIPHERO INTEGRATION COMPLETE** - Previous implementation:

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
- **Trackstar Universal WMS API**: Complete integration with 44+ webhook events covering all WMS categories (order, inventory, product, receiving, returns, warehouse, billing). Uses universal API key (269fcaf8b50a4fb4b384724f3e5d76db) for seamless connectivity across multiple fulfillment providers including ShipHero, ShipBob, Fulfillment Works, and others. **WEBHOOK SYSTEM**: Comprehensive webhook handler for real-time order fulfillment workflows. **CLEAN ARCHITECTURE**: Pure Trackstar integration with no legacy system dependencies.
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