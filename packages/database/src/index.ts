export * from '@prisma/client';

// Export the Prisma client instance
export { prisma } from './client';

// Re-export commonly used types
export type {
  User,
  ThreePL,
  Brand,
  Membership,
  Integration,
  Product,
  Order,
  OrderItem,
  Shipment,
  InventorySnapshot,
  WebhookEvent,
  JobRun,
  MessageStatus,
  Message,
  MessageAttachment,
  Comment,
  Mention,
} from '@prisma/client';

// Export utility functions (excluding types that are already exported)
export * from './utils';
