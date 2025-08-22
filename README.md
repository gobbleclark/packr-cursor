# Packr CS - Customer Service Platform

A multi-tenant 3PL customer service application with Trackstar HQ integration, ticketing/messaging, dashboards, and role-based access control.

## 🏗️ Architecture

- **Monorepo** with Turbo for build orchestration
- **Frontend**: Next.js 14 with React, TypeScript, Tailwind CSS
- **Backend**: Node.js + Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue System**: BullMQ + Redis
- **Authentication**: Clerk (hosted auth)
- **File Storage**: S3/R2 via presigned uploads
- **Observability**: Sentry, PostHog, Pino logs

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

### Features

- Webhook processing for real-time updates
- Periodic sync jobs (every 5 minutes)
- Idempotent data processing
- Raw JSON storage for complete data capture

### Sync Strategy

1. **Webhooks**: Subscribe to all Trackstar events
2. **Backfill**: Periodic pull jobs to heal missed webhooks
3. **Idempotency**: Check existing records before processing
4. **Error Handling**: Sentry integration + retry logic

## 💬 Messaging System

### Features

- Rich text editor (TipTap/Quill)
- File attachments via S3 presigned URLs
- @mentions with autocomplete
- Status management (3PL-defined statuses)
- Urgent message queue
- Comment threads

### Permissions

- Brand users see only their brand's messages
- 3PL users see all messages under their 3PL
- Super Admin sees everything

## 📊 Dashboards

### Metrics

- Open orders count
- Shipped orders (date range)
- Average time to ship
- Shipments by carrier/service
- Low inventory indicators

### Views

- **Super Admin**: 3PL/brand overview + sync health
- **3PL Admin**: Brands list, message statuses, invites
- **Brand**: Dashboard, orders table, messages

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

### Code Quality

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Zod**: Request validation
- **TypeScript**: Type safety

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

- **Auth**: `/api/auth/*` (Clerk middleware)
- **ThreePLs**: `/api/threepls/*`
- **Brands**: `/api/brands/*`
- **Orders**: `/api/brands/:id/orders`
- **Messages**: `/api/brands/:id/messages`
- **Webhooks**: `/webhooks/trackstar`

### Authentication

All protected routes use Clerk JWT validation + custom RBAC middleware.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

Private - Packr Logistics

## 🆘 Support

For questions or issues, please contact the development team.
