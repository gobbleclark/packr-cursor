# Packr - Multi-Tenant 3PL Customer Service Platform

A comprehensive multi-tenant SaaS platform for 3PLs and Brands with advanced Trackstar integration, real-time chat, order management, and intelligent automation.

## ✨ Key Features

### 🎯 **Orders Management**
- **Complete Order Lifecycle**: View, edit, track, and manage orders end-to-end
- **Trackstar Write-Through**: All order mutations sync to Trackstar in real-time
- **Multi-modal Access**: Edit orders from dedicated Orders page or Chat interface
- **Smart Validation**: Business rules prevent invalid operations (e.g., editing shipped items)
- **Audit Trail**: Complete history of all order changes with user attribution

### 💬 **Real-Time Chat & Collaboration**
- **Instant Messaging**: Socket.io-powered real-time communication
- **Intelligent Bot**: Automatically detects order numbers and suggests actions
- **Task Management**: Convert conversations into actionable tasks with assignments
- **File Sharing**: Secure file uploads with S3 integration
- **Cross-Platform**: Consistent experience across web and mobile

### 🔄 **Trackstar Integration**
- **Write-Through Architecture**: Trackstar as single source of truth
- **Real-Time Sync**: Webhooks + periodic healing for data consistency  
- **Error Resilience**: Graceful handling of API failures with user feedback
- **Idempotent Operations**: Safe retry logic with conflict resolution
- **Performance Optimized**: Fast reads from cache, reliable writes to Trackstar

### 🏢 **Multi-Tenancy & RBAC**
- **Flexible Hierarchy**: 3PLs manage multiple Brands with granular permissions
- **Secure Isolation**: Complete tenant data separation with row-level security
- **Role-Based Access**: Fine-grained permissions for different user types
- **Scalable Architecture**: Handles thousands of tenants with consistent performance

### 📊 **Analytics & Insights**
- **Real-Time Dashboards**: Live metrics with Socket.io updates
- **Performance KPIs**: Order fulfillment, response times, carrier analytics
- **Custom Reports**: Flexible reporting with export capabilities
- **Predictive Insights**: Inventory forecasting and capacity planning

## 🏗️ Architecture

- **Monorepo** with Turbo for build orchestration
- **Frontend**: Next.js 14 with React, TypeScript, Tailwind CSS
- **Backend**: Node.js + Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.io for chat and notifications
- **Queue System**: BullMQ + Redis
- **Authentication**: JWT-based auth with role-based access control
- **File Storage**: S3/R2 via presigned uploads
- **Observability**: Structured logging with Pino
- **Integration**: Trackstar write-through architecture

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- Docker (optional)

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

```bash
cp env.example .env
# Edit .env with your configuration
```

### 3. Database Setup

```bash
# Generate Prisma client
npx turbo run db:generate

# Run migrations
npx turbo run db:migrate

# Or push schema directly
npx turbo run db:push
```

### 4. Start Development

```bash
# Start both apps
npx turbo run dev

# Or start individually
npm run dev --workspace=@packr/api
npm run dev --workspace=@packr/web
```

## 📁 Project Structure

```
packr-cs/
├── apps/
│   ├── api/                 # Express API server
│   └── web/                 # Next.js frontend
├── packages/
│   ├── database/            # Prisma schema & client
│   └── shared/              # Shared utilities
├── turbo.json               # Build pipeline config
└── package.json             # Root workspace
```

## 🔐 Authentication & RBAC

### User Roles

- **SUPER_ADMIN**: Packr internal, sees everything
- **THREEPL_ADMIN**: Manages 3PL, creates brands
- **THREEPL_MEMBER**: Standard 3PL team member
- **BRAND_ADMIN**: Manages brand users, sees brand data
- **BRAND_MEMBER**: Standard brand user

### Multi-tenancy

- **ThreePL**: The customer we sell to
- **Brands**: Child of a ThreePL
- **Users**: Belong to one or more ThreePL/Brand via Memberships

## 🔌 Trackstar Integration

### Write-Through Architecture

Packr implements a **write-through** pattern where Trackstar is the **source of truth** for all order operations:

- **Order Mutations**: All changes (address, items, carrier, notes, cancel) go to Trackstar first
- **Data Consistency**: Only successful Trackstar operations update Packr's cache
- **Error Handling**: Trackstar rejections prevent Packr DB changes with precise error messages
- **Idempotency**: All operations use idempotency keys (`tenant:brand:orderId:action:hash`)

### Sync Strategies & Schedules

#### 1. Real-Time Webhooks (Primary)
- **Trigger**: Immediate when data changes in Trackstar
- **Latency**: < 1 second
- **Data Types**: Orders, Inventory, Products, Shipments
- **Reliability**: Primary sync method with automatic retry logic

#### 2. Periodic Incremental Sync (Fallback)
- **Schedule**: Every 5 minutes (`*/5 * * * *`)
- **Purpose**: Catch missed webhooks and ensure data consistency
- **Scope**: Only syncs data modified since last sync (5+ minute threshold)
- **Data Types**: Orders, Products, Inventory, Shipments
- **Delay**: 1 second between API calls to avoid rate limiting
- **Retry**: 3 attempts with exponential backoff (2s base delay)

#### 3. Delayed Backfill (New Integrations)
- **Schedule**: 5 hours after initial integration setup
- **Purpose**: Complete historical data sync after initial connection
- **Scope**: Full data backfill for new brand integrations
- **Delay**: Allows time for initial webhook setup and testing

#### 4. Nightly Reconciliation (Data Integrity)
- **Schedule**: Daily at 2:00 AM EST (`0 2 * * *`)
- **Purpose**: Full data integrity check and healing
- **Scope**: Last 30 days of all data types
- **Process**: 
  - Compares Packr cache vs Trackstar source data
  - Identifies and fixes discrepancies
  - Updates missing or stale records
  - Runs for all active brand integrations

#### 5. Manual Sync (On-Demand)
- **Trigger**: User-initiated or API-triggered
- **Purpose**: Immediate sync for specific brands
- **Scope**: All data types for the specified brand
- **Use Cases**: Troubleshooting, after integration changes

### Sync Error Handling

- **Failed Webhooks**: Automatic retry with exponential backoff (2-hour max delay)
- **API Rate Limits**: Built-in delays and retry logic
- **Integration Errors**: Mark integration as ERROR status, alert administrators
- **Partial Failures**: Continue processing other brands/data types
- **Cache Layer**: Fast reads from Packr DB, writes through Trackstar
- **Conflict Resolution**: Trackstar always wins, cache heals automatically

### Order Management

- **Single Order View**: Comprehensive order details with edit capabilities
- **Safe Mutations**: Role-gated editing with business rule validation
- **Real-time Updates**: Socket.io notifications for order changes
- **Audit Trail**: Complete history of all order modifications
- **Multi-modal Access**: Same functionality in Orders page and Chat interface

## 💬 Real-Time Chat & Messaging

### Chat Interface

- **Real-time Communication**: Socket.io-powered instant messaging
- **Multi-room Support**: Separate chat rooms per 3PL-Brand relationship
- **Rich Media**: File uploads, attachments, and rich text formatting
- **User Mentions**: @mention system with autocomplete and notifications
- **Typing Indicators**: Live typing status for better UX
- **Message Threading**: Reply to specific messages with context

### Intelligent Bot Integration

- **Order Detection**: Automatically detects order numbers in messages
- **Smart Suggestions**: Context-aware action cards for order operations
- **Modal Integration**: Edit orders directly from chat with Trackstar sync
- **Proactive Assistance**: Bot suggests relevant actions based on message content

### Task Management

- **Task Creation**: Convert messages to actionable tasks
- **Assignment System**: Assign tasks to team members
- **Status Tracking**: TODO, IN_PROGRESS, COMPLETED, CANCELLED
- **Due Dates**: Set and track task deadlines
- **Priority Levels**: LOW, NORMAL, HIGH, URGENT

### Permissions & Security

- **Tenant Isolation**: Brand users see only their brand's chats
- **Role-based Access**: 3PL users manage multiple brands
- **Secure File Handling**: S3 presigned URLs for safe file sharing
- **Audit Logging**: Complete chat history and user activity tracking

## 📊 Dashboards & Analytics

### Real-time Metrics

- **Order Analytics**: Open orders, shipped orders, fulfillment rates
- **Performance KPIs**: Average time to ship, processing times
- **Carrier Analytics**: Shipments by carrier/service, delivery performance
- **Inventory Insights**: Low stock alerts, backorder tracking
- **Chat Metrics**: Response times, message volumes, task completion

### Multi-tenant Views

- **Super Admin**: Cross-tenant analytics, system health, sync status
- **3PL Dashboard**: Multi-brand overview, team performance, capacity planning
- **Brand Dashboard**: Brand-specific metrics, order status, chat activity
- **User Dashboard**: Personal tasks, assigned orders, recent activity

### Advanced Features

- **Real-time Updates**: Live dashboard updates via Socket.io
- **Customizable Widgets**: Drag-and-drop dashboard configuration
- **Export Capabilities**: CSV/PDF exports for reporting
- **Date Range Filtering**: Flexible time period analysis
- **Drill-down Analytics**: Click-through to detailed views

## 🛠️ Development

### Available Scripts

```bash
# Build all packages
npm run build

# Development mode
npm run dev

# Linting
npm run lint

# Database operations
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

### Code Quality & Testing

- **ESLint**: Code linting with strict TypeScript rules
- **Prettier**: Consistent code formatting
- **TypeScript**: Full type safety across frontend and backend
- **Zod**: Runtime request/response validation
- **Jest**: Unit and integration testing
- **Vitest**: Fast frontend testing with React Testing Library
- **Test Coverage**: Comprehensive test coverage reporting
- **CI/CD**: Automated testing and deployment pipelines

## 🚀 Deployment

### Heroku (API + Worker)

```bash
# Create apps
heroku create packr-api
heroku create packr-worker

# Add addons
heroku addons:create heroku-postgresql:mini -a packr-api
heroku addons:create heroku-redis:mini -a packr-api

# Set config vars
heroku config:set DATABASE_URL=... -a packr-api
# ... other vars

# Deploy
git push heroku main
```

### Vercel (Web)

1. Import repo in Vercel
2. Select `apps/web` as root
3. Set environment variables
4. Deploy

## 🔧 Configuration

### Environment Variables

See `env.example` for all required variables:

- Database connection
- Redis connection
- S3/R2 credentials
- Clerk authentication
- Sentry/PostHog keys
- Trackstar webhook secret

### Database Schema

The Prisma schema includes all entities:

- Users, ThreePLs, Brands
- Memberships (RBAC)
- Products, Orders, Shipments
- Messages, Comments, Attachments
- Integrations, Webhooks, Job Runs

## 📚 API Reference

### Core Endpoints

#### Authentication & Users
- **Auth**: `/api/auth/*` - JWT-based authentication
- **Users**: `/api/users/*` - User management and profiles

#### Multi-tenant Resources
- **ThreePLs**: `/api/threepls/*` - 3PL management
- **Brands**: `/api/brands/*` - Brand management
- **Memberships**: `/api/memberships/*` - User-tenant relationships

#### Order Management (Trackstar Write-Through)
- **Orders List**: `GET /api/orders` - Fast server-side filtering
- **Order Detail**: `GET /api/orders/:orderId` - Single order view
- **Update Address**: `POST /api/orders/:orderId/address` - Write-through to Trackstar
- **Update Items**: `POST /api/orders/:orderId/items` - Write-through to Trackstar
- **Update Shipping**: `POST /api/orders/:orderId/shipping` - Write-through to Trackstar
- **Add Notes**: `POST /api/orders/:orderId/notes` - Write-through to Trackstar
- **Cancel Order**: `POST /api/orders/:orderId/cancel` - Write-through to Trackstar

#### Real-time Chat
- **Chat Rooms**: `/api/chat/rooms` - Chat room management
- **Messages**: `/api/chat/messages` - Message CRUD operations
- **Tasks**: `/api/chat/tasks` - Task management from chat
- **File Uploads**: `/api/chat/files` - Secure file handling

#### Integrations
- **Trackstar Webhooks**: `/api/webhooks/trackstar` - Real-time sync
- **Inventory Webhooks**: `/api/webhooks/inventory` - Stock updates

### Authentication & Authorization

- **JWT Tokens**: Stateless authentication with role-based claims
- **RBAC Middleware**: Automatic tenant isolation and permission checking
- **Idempotency**: All mutation endpoints support idempotency keys
- **Rate Limiting**: API rate limiting per tenant and endpoint

## 🚀 Recent Updates

### v2.1.0 - Chat Bot Order Integration (Latest)
- ✅ **Chat Order Actions**: Edit orders directly from chat with Trackstar sync
- ✅ **Modal Integration**: Comprehensive order editing modals in chat interface  
- ✅ **Write-Through Consistency**: Same Trackstar integration as Orders page
- ✅ **TypeScript Improvements**: Enhanced type safety and compatibility fixes
- ✅ **Test Coverage**: Added comprehensive test suite for new functionality

### v2.0.0 - Orders Enhancement
- ✅ **Single Order View**: Detailed order pages with full editing capabilities
- ✅ **Trackstar Write-Through**: Real-time sync for all order mutations
- ✅ **Business Rules**: Smart validation prevents invalid operations
- ✅ **Audit Trail**: Complete order change history with user attribution
- ✅ **Performance**: Optimized caching with fast reads, reliable writes

### v1.5.0 - Real-Time Chat
- ✅ **Socket.io Integration**: Real-time messaging and notifications
- ✅ **Multi-Room Support**: Separate chat rooms per 3PL-Brand relationship
- ✅ **Task Management**: Convert messages to actionable tasks
- ✅ **File Uploads**: Secure file sharing with S3 integration
- ✅ **Bot Intelligence**: Automatic order detection and smart suggestions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with proper tests
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode requirements
- Add tests for new functionality
- Update documentation for API changes
- Ensure all linting and type checks pass
- Test Trackstar integration thoroughly

## 📄 License

Private - Packr Logistics

## 🆘 Support

For questions or issues:
- **Development Team**: Contact via internal Slack
- **Bug Reports**: Create GitHub issues with detailed reproduction steps
- **Feature Requests**: Discuss in team meetings or GitHub discussions
