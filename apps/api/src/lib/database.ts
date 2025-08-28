import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export default prisma;

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
  InboundShipment,
  InboundShipmentItem,
  InboundShipmentReceipt,
  InboundShipmentStatus,
  Warehouse,
  InventoryItem,
  OrderStatus,
  UserRole,
  Prisma,
} from '@prisma/client';

export * from '@prisma/client';
