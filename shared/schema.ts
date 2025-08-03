import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'threePL', 'brand']);
export const ticketStatusEnum = pgEnum('ticket_status', ['open', 'closed', 'pending']);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['normal', 'urgent', 'high', 'low']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled']);

// Users table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default('brand'),
  threePlId: varchar("three_pl_id").references(() => threePLs.id),
  brandId: varchar("brand_id").references(() => brands.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 3PL Companies
export const threePLs = pgTable("three_pls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  trackstarApiKey: varchar("trackstar_api_key"),
  shipHeroPassword: varchar("shiphero_password"), // Trackstar organization API key
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Brand Clients
export const brands = pgTable("brands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email"),
  threePlId: varchar("three_pl_id").notNull().references(() => threePLs.id),
  shipHeroApiKey: varchar("ship_hero_api_key"),
  shipHeroPassword: varchar("ship_hero_password"),
  shipHeroUserId: varchar("ship_hero_user_id"),
  trackstarApiKey: varchar("trackstar_api_key"),
  trackstarConnectionId: varchar("trackstar_connection_id"),
  trackstarIntegrationName: varchar("trackstar_integration_name"),
  invitationToken: varchar("invitation_token"), // For brand signup invitations
  invitationSentAt: timestamp("invitation_sent_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").notNull().unique(),
  brandId: varchar("brand_id").notNull().references(() => brands.id),
  customerName: varchar("customer_name"),
  customerEmail: varchar("customer_email"),
  shippingAddress: jsonb("shipping_address"),
  billingAddress: jsonb("billing_address"),
  status: orderStatusEnum("status").default('pending'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  shippingMethod: varchar("shipping_method"),
  trackingNumber: varchar("tracking_number"),
  shipHeroOrderId: varchar("ship_hero_order_id").unique(),
  trackstarOrderId: varchar("trackstar_order_id").unique(),
  orderItems: jsonb("order_items"),
  backorderQuantity: integer("backorder_quantity").default(0), // Track backorder quantity for late order tool
  // Allocation tracking timestamps for late order analysis
  orderCreatedAt: timestamp("order_created_at"), // When order was created in ShipHero
  allocatedAt: timestamp("allocated_at"), // When order was allocated in warehouse
  shippedAt: timestamp("shipped_at"), // When order was shipped
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Shipments
export const shipments = pgTable("shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  brandId: varchar("brand_id").notNull().references(() => brands.id),
  shipHeroShipmentId: varchar("ship_hero_shipment_id").unique(),
  trackingNumber: varchar("tracking_number"),
  carrier: varchar("carrier"),
  service: varchar("service"),
  status: varchar("status").default('pending'),
  shippedAt: timestamp("shipped_at"),
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Warehouses
export const warehouses = pgTable("warehouses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  address: jsonb("address"),
  brandId: varchar("brand_id").notNull().references(() => brands.id),
  shipHeroWarehouseId: varchar("ship_hero_warehouse_id").unique(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Products/Inventory
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: varchar("sku").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  brandId: varchar("brand_id").notNull().references(() => brands.id),
  price: decimal("price", { precision: 10, scale: 2 }),
  weight: decimal("weight", { precision: 8, scale: 3 }),
  dimensions: jsonb("dimensions"),
  inventoryCount: integer("inventory_count").default(0), // Total across all warehouses
  reservedQuantity: integer("reserved_quantity").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  shipHeroProductId: varchar("ship_hero_product_id").unique(),
  trackstarProductId: varchar("trackstar_product_id").unique(),
  barcode: varchar("barcode"),
  hsCode: varchar("hs_code"),
  countryOfOrigin: varchar("country_of_origin"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Warehouse-specific inventory tracking
export const productWarehouse = pgTable("product_warehouse", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  warehouseId: varchar("warehouse_id").notNull(), // ShipHero warehouse ID
  warehouseName: varchar("warehouse_name").notNull(),
  onHand: integer("on_hand").default(0),
  allocated: integer("allocated").default(0),
  available: integer("available").default(0),
  committed: integer("committed").default(0),
  reserved: integer("reserved").default(0),
  backordered: integer("backordered").default(0),
  pending: integer("pending").default(0),
  sellable: integer("sellable").default(0),
  nonSellable: integer("non_sellable").default(0),
  inventoryBin: varchar("inventory_bin").default(""),
  overstockBin: varchar("overstock_bin").default(""),
  reorderLevel: integer("reorder_level").default(0),
  reorderAmount: integer("reorder_amount").default(0),
  replenishmentLevel: integer("replenishment_level").default(0),
  lastSyncAt: timestamp("last_sync_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint on product-warehouse combination
  index("product_warehouse_unique").on(table.productId, table.warehouseId),
]);

// Sync Status Tracking
export const syncStatus = pgTable("sync_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandId: varchar("brand_id").notNull().references(() => brands.id),
  syncType: varchar("sync_type").notNull(), // 'orders', 'products', 'shipments', 'inventory'
  lastSyncAt: timestamp("last_sync_at").notNull(),
  lastSyncStatus: varchar("last_sync_status").notNull(), // 'success', 'error', 'partial'
  recordsProcessed: integer("records_processed").default(0),
  errorCount: integer("error_count").default(0),
  errorDetails: jsonb("error_details"),
  nextScheduledSync: timestamp("next_scheduled_sync"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages/Tickets
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number").notNull().unique(),
  title: varchar("title").notNull(),
  description: text("description"),
  status: ticketStatusEnum("status").default('open'),
  priority: ticketPriorityEnum("priority").default('normal'),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  brandId: varchar("brand_id").references(() => brands.id),
  threePlId: varchar("three_pl_id").references(() => threePLs.id),
  orderId: varchar("order_id").references(() => orders.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Ticket Comments (for threading)
export const ticketComments = pgTable("ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").defaultNow(),
});

// File Attachments
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  size: integer("size").notNull(),
  path: varchar("path").notNull(),
  ticketId: varchar("ticket_id").references(() => tickets.id),
  commentId: varchar("comment_id").references(() => ticketComments.id),
  uploadedById: varchar("uploaded_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  threePL: one(threePLs, {
    fields: [users.threePlId],
    references: [threePLs.id],
  }),
  brand: one(brands, {
    fields: [users.brandId],
    references: [brands.id],
  }),
  createdTickets: many(tickets, { relationName: "createdTickets" }),
  assignedTickets: many(tickets, { relationName: "assignedTickets" }),
  comments: many(ticketComments),
  attachments: many(attachments),
}));

export const threePLsRelations = relations(threePLs, ({ many }) => ({
  users: many(users),
  brands: many(brands),
  tickets: many(tickets),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  threePL: one(threePLs, {
    fields: [brands.threePlId],
    references: [threePLs.id],
  }),
  users: many(users),
  orders: many(orders),
  products: many(products),
  tickets: many(tickets),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  brand: one(brands, {
    fields: [orders.brandId],
    references: [brands.id],
  }),
  tickets: many(tickets),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  warehouseInventory: many(productWarehouse),
}));

export const productWarehouseRelations = relations(productWarehouse, ({ one }) => ({
  product: one(products, {
    fields: [productWarehouse.productId],
    references: [products.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [tickets.createdById],
    references: [users.id],
    relationName: "createdTickets",
  }),
  assignedTo: one(users, {
    fields: [tickets.assignedToId],
    references: [users.id],
    relationName: "assignedTickets",
  }),
  brand: one(brands, {
    fields: [tickets.brandId],
    references: [brands.id],
  }),
  threePL: one(threePLs, {
    fields: [tickets.threePlId],
    references: [threePLs.id],
  }),
  order: one(orders, {
    fields: [tickets.orderId],
    references: [orders.id],
  }),
  comments: many(ticketComments),
  attachments: many(attachments),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one, many }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketComments.userId],
    references: [users.id],
  }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [attachments.ticketId],
    references: [tickets.id],
  }),
  comment: one(ticketComments, {
    fields: [attachments.commentId],
    references: [ticketComments.id],
  }),
  uploadedBy: one(users, {
    fields: [attachments.uploadedById],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertThreePLSchema = createInsertSchema(threePLs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBrandSchema = createInsertSchema(brands).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductWarehouseSchema = createInsertSchema(productWarehouse).omit({
  id: true,
  updatedAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTicketCommentSchema = createInsertSchema(ticketComments).omit({
  id: true,
  createdAt: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});

// Upsert schema for Replit Auth
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ThreePL = typeof threePLs.$inferSelect;
export type InsertThreePL = z.infer<typeof insertThreePLSchema>;
export type Brand = typeof brands.$inferSelect;
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type TicketComment = typeof ticketComments.$inferSelect;
export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;

export type ProductWarehouse = typeof productWarehouse.$inferSelect;
export type InsertProductWarehouse = z.infer<typeof insertProductWarehouseSchema>;
