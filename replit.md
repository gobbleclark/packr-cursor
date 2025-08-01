# Overview

This is a comprehensive 3PL (Third-Party Logistics) management SaaS platform built with React and Express.js. The application enables 3PL companies to manage their brand clients, handle support tickets, track orders, manage inventory, and integrate with ShipHero's fulfillment API. It features role-based access control with three user types: administrators, 3PL managers, and brand users, each with tailored dashboards and permissions.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Replit Auth with OpenID Connect integration
- **Session Management**: Express sessions with PostgreSQL storage
- **File Uploads**: Multer middleware for handling attachments
- **Background Jobs**: Node-cron for scheduled tasks (order sync, inventory sync)

## Database Design
- **Primary Database**: PostgreSQL with Neon serverless connection
- **Schema Management**: Drizzle Kit for migrations and schema definition
- **Key Tables**: Users, 3PL companies, brands, orders, products, tickets, comments, attachments
- **Relationships**: Hierarchical structure with users belonging to either 3PL companies or brands
- **Enums**: Role-based permissions, ticket statuses, order statuses, priority levels

## Authentication & Authorization
- **Provider**: Replit's OpenID Connect authentication system
- **Session Storage**: PostgreSQL-backed session store with 7-day TTL
- **Role-Based Access**: Three distinct user roles with different permissions and dashboard views
- **Middleware**: Custom authentication middleware for protected routes

## API Integration
- **ShipHero Service**: Mock service class prepared for real API integration
- **Background Synchronization**: Automated order and inventory syncing every 5 minutes and hourly respectively
- **File Storage**: Local file system storage for ticket attachments with plans for cloud storage

## Development Tooling
- **Build System**: Vite with React plugin and TypeScript support
- **Code Quality**: TypeScript strict mode with comprehensive type definitions
- **Development Experience**: Hot module replacement, error overlays, and Replit-specific development tools

# External Dependencies

## Database & Storage
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **Local File System**: Temporary storage for uploaded attachments (planned migration to cloud storage)

## Authentication Services
- **Replit Auth**: OpenID Connect provider for user authentication and session management
- **Session Storage**: PostgreSQL-backed session persistence

## Third-Party APIs
- **ShipHero API**: E-commerce fulfillment platform integration for order and inventory management (currently mocked, ready for production implementation)

## Development & Deployment
- **Replit Platform**: Development environment with built-in deployment capabilities
- **Vite Development Server**: Hot reload and development tooling
- **TypeScript Compiler**: Type checking and code validation

## UI & Styling
- **Radix UI**: Headless component primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide Icons**: Comprehensive icon library for UI elements

## State Management & HTTP
- **TanStack Query**: Server state management with caching and synchronization
- **Fetch API**: Native HTTP client for API communications