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
export const orderStatusEnum = pgEnum('order_status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'fulfilled', 'allocated', 'on_hold', 'unfulfilled', 'partially_fulfilled']);

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
  
  // ShipHero-specific fields
  shipHeroOrderId: varchar("ship_hero_order_id").unique(),
  shipHeroLegacyId: varchar("ship_hero_legacy_id"), // ShipHero legacy_id field
  shopName: varchar("shop_name"), // ShipHero shop_name field
  fulfillmentStatus: varchar("fulfillment_status"), // ShipHero fulfillment_status
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }), // Order subtotal before tax/shipping
  totalTax: decimal("total_tax", { precision: 10, scale: 2 }), // Tax amount
  totalShipping: decimal("total_shipping", { precision: 10, scale: 2 }), // Shipping cost
  totalDiscounts: decimal("total_discounts", { precision: 10, scale: 2 }), // Total discounts
  profile: jsonb("profile"), // ShipHero customer profile data
  holdUntilDate: timestamp("hold_until_date"), // ShipHero hold_until_date
  requiredShipDate: timestamp("required_ship_date"), // ShipHero required_ship_date
  priorityFlag: boolean("priority_flag").default(false),
  tags: jsonb("tags").default('[]'),
  
  // Additional ShipHero tracking fields
  orderSource: varchar("order_source"), // Where the order originated (Shopify, WooCommerce, etc.)
  orderCurrency: varchar("order_currency").default('USD'), // Order currency
  warehouse: varchar("warehouse"), // Primary warehouse for fulfillment
  shippingCarrier: varchar("shipping_carrier"), // Carrier used for shipping
  shippingService: varchar("shipping_service"), // Specific shipping service
  insuranceValue: decimal("insurance_value", { precision: 10, scale: 2 }), // Insurance amount
  fraudHold: boolean("fraud_hold").default(false), // If order is on fraud hold
  addressValidated: boolean("address_validated").default(false), // If address was validated
  
  // External system IDs
  trackstarOrderId: varchar("trackstar_order_id").unique(),
  externalOrderId: varchar("external_order_id"), // Original order ID from source system
  
  // Quantity tracking for analytics
  backorderQuantity: integer("backorder_quantity").default(0), // Track backorder quantity for late order tool
  totalQuantity: integer("total_quantity").default(0), // Total items in order
  
  // Allocation tracking timestamps for late order analysis
  orderCreatedAt: timestamp("order_created_at"), // When order was created in ShipHero
  orderDate: timestamp("order_date"), // ShipHero order_date field
  allocatedAt: timestamp("allocated_at"), // When order was allocated in warehouse - updated by webhook
  packedAt: timestamp("packed_at"), // When order was packed
  shippedAt: timestamp("shipped_at"), // When order was shipped
  deliveredAt: timestamp("delivered_at"), // When order was delivered
  cancelledAt: timestamp("cancelled_at"), // When order was cancelled
  
  // ShipHero sync tracking
  shipHeroUpdatedAt: timestamp("ship_hero_updated_at"), // ShipHero updated_at field
  lastSyncAt: timestamp("last_sync_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order Items (line items for each order)
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: varchar("product_id").references(() => products.id), // Optional FK to products table
  shipHeroLineItemId: varchar("ship_hero_line_item_id"), // External system ID
  sku: varchar("sku").notNull(),
  productName: varchar("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  quantityAllocated: integer("quantity_allocated").default(0),
  quantityShipped: integer("quantity_shipped").default(0),
  backorderQuantity: integer("backorder_quantity").default(0),
  unitPrice: decimal("unit_price", { precision: 10, scale: 4 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  fulfillmentStatus: varchar("fulfillment_status").default('pending'),
  warehouseId: varchar("warehouse_id"), // Which warehouse this item is allocated from
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Index for faster order queries
  index("order_items_order_id_idx").on(table.orderId),
  // Index for SKU-based analytics
  index("order_items_sku_idx").on(table.sku),
  // Index for product analytics
  index("order_items_product_id_idx").on(table.productId),
]);

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

// Purchase Orders - New addition for ShipHero integration
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandId: varchar("brand_id").notNull().references(() => brands.id),
  poNumber: varchar("po_number").notNull().unique(),
  shipHeroPoId: varchar("ship_hero_po_id").unique(),
  supplierName: varchar("supplier_name").notNull(),
  supplierEmail: varchar("supplier_email"),
  warehouse: varchar("warehouse"),
  status: varchar("status").default('draft'), // draft, pending, receiving, received, cancelled
  expectedDate: timestamp("expected_date"),
  receivedAt: timestamp("received_at"),
  cancelledAt: timestamp("cancelled_at"),
  notes: text("notes"),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }),
  shipHeroUpdatedAt: timestamp("ship_hero_updated_at"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Order Line Items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poId: varchar("po_id").notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  shipHeroLineItemId: varchar("ship_hero_line_item_id"),
  sku: varchar("sku").notNull(),
  productName: varchar("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  quantityReceived: integer("quantity_received").default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  expectedDate: timestamp("expected_date"),
  status: varchar("status").default('pending'), // pending, receiving, received, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("po_items_po_id_idx").on(table.poId),
  index("po_items_sku_idx").on(table.sku),
]);

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
  purchaseOrders: many(purchaseOrders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  brand: one(brands, {
    fields: [orders.brandId],
    references: [brands.id],
  }),
  orderItems: many(orderItems),
  tickets: many(tickets),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  orderItems: many(orderItems),
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

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  brand: one(brands, {
    fields: [purchaseOrders.brandId],
    references: [brands.id],
  }),
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.poId],
    references: [purchaseOrders.id],
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

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
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

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
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
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
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

export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = z.infer<typeof insertShipmentSchema>;
