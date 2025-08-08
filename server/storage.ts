import {
  users,
  threePLs,
  brands,
  orders,
  orderItems,
  products,
  tickets,
  ticketComments,
  attachments,
  type User,
  type UpsertUser,
  type ThreePL,
  type InsertThreePL,
  type Brand,
  type InsertBrand,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type Product,
  type InsertProduct,
  type Ticket,
  type InsertTicket,
  type TicketComment,
  type InsertTicketComment,
  type Attachment,
  type InsertAttachment,
  shipments,
  warehouses,
  syncStatus,
  productWarehouse,
  type ProductWarehouse,
  type InsertProductWarehouse,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, count, isNull, isNotNull, gte, lte, lt, ne, inArray, asc } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUsersByBrand(brandId: string): Promise<User[]>;
  createBrandUser(userData: any): Promise<User>;
  updateBrandUser(userId: string, userData: any): Promise<User>;
  deleteBrandUser(userId: string): Promise<void>;
  
  // 3PL operations
  getThreePL(id: string): Promise<ThreePL | undefined>;
  createThreePL(threePL: InsertThreePL): Promise<ThreePL>;
  getThreePLs(): Promise<ThreePL[]>;
  updateThreePlTrackstarApiKey(id: string, apiKey: string): Promise<ThreePL>;
  
  // Brand operations
  getBrand(id: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  getBrandsByThreePL(threePlId: string): Promise<Brand[]>;
  updateBrandApiCredentials(id: string, apiKey: string, userId: string): Promise<Brand>;
  updateBrandShipHeroCredentials(id: string, username: string, password: string, userId?: string): Promise<Brand>;
  updateBrandTrackstarCredentials(id: string, apiKey: string | null): Promise<Brand>;
  getBrandByInvitationToken(token: string): Promise<Brand | undefined>;
  updateBrandInvitationStatus(id: string, isActive: boolean): Promise<Brand>;
  updateBrandInvitationToken(id: string, token: string): Promise<Brand>;
  getDashboardStats(userId: string): Promise<any>;
  
  // Order operations
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  getOrdersByBrand(brandId: string): Promise<Order[]>;
  getOrdersByThreePL(threePlId: string): Promise<Order[]>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  updateOrderShipping(id: string, address: any, method?: string): Promise<Order>;
  getOrderByShipHeroId?(shipHeroId: string): Promise<Order | undefined>;
  updateOrder?(id: string, orderData: any): Promise<Order>;
  
  // Order item operations with normalized table
  getOrderWithItems?(id: string): Promise<Order & { orderItemsNormalized?: OrderItem[] } | undefined>;
  getOrdersWithItems?(filters?: { brandId?: string; threePlId?: string; limit?: number }): Promise<(Order & { orderItemsNormalized?: OrderItem[] })[]>;
  getOrdersByBrandWithItems?(brandId: string): Promise<(Order & { orderItemsNormalized?: OrderItem[] })[]>;
  getOrdersByThreePLWithItems?(threePlId: string): Promise<(Order & { orderItemsNormalized?: OrderItem[] })[]>;
  
  // Product operations
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  getProductsByBrand(brandId: string): Promise<Product[]>;
  getProductsWithWarehouseByBrand(brandId: string): Promise<any[]>;
  getProductsByThreePL(threePlId: string): Promise<Product[]>;
  getProductsWithWarehouseByThreePL(threePlId: string): Promise<any[]>;
  updateProductInventory(id: string, count: number): Promise<Product>;
  
  // Warehouse inventory operations
  upsertProductWarehouse(productWarehouse: InsertProductWarehouse): Promise<ProductWarehouse>;
  getProductWarehouseInventory(productId: string): Promise<ProductWarehouse[]>;
  getWarehouseInventoryByBrand(brandId: string): Promise<{ product: Product; warehouses: ProductWarehouse[] }[]>;
  getWarehousesByBrand(brandId: string): Promise<any[]>;
  getWarehousesByThreePL(threePlId: string): Promise<any[]>;
  
  // Ticket operations
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTicketsByUser(userId: string): Promise<Ticket[]>;
  getTicketsByBrand(brandId: string): Promise<Ticket[]>;
  getTicketsByThreePL(threePlId: string): Promise<Ticket[]>;
  updateTicketStatus(id: string, status: string): Promise<Ticket>;
  getTicketsWithComments(filters?: { status?: string; priority?: string; brandId?: string }): Promise<any[]>;
  
  // Comment operations
  createComment(comment: InsertTicketComment): Promise<TicketComment>;
  getCommentsByTicket(ticketId: string): Promise<TicketComment[]>;
  
  // Attachment operations
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  getAttachmentsByTicket(ticketId: string): Promise<Attachment[]>;
  
  // Dashboard stats
  getDashboardStats(userId: string, role: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // Sync methods for ShipHero integration
  async getOrderByShipHeroId(shipHeroOrderId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.shipHeroOrderId, shipHeroOrderId));
    return order;
  }

  async getOrderByTrackstarId(trackstarOrderId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.trackstarOrderId, trackstarOrderId));
    return order;
  }

  async getProductByShipHeroId(shipHeroProductId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.shipHeroProductId, shipHeroProductId));
    return product;
  }

  async getProductByTrackstarId(trackstarProductId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.trackstarProductId, trackstarProductId));
    return product;
  }

  async updateBrandSyncStatus(brandId: string, lastSyncAt: Date): Promise<void> {
    // Use sync_status table for tracking instead of adding column to brands table
    try {
      await this.updateSyncStatus(brandId, 'general', 'success', 0);
    } catch (error) {
      console.error('Failed to update brand sync status:', error);
    }
  }

  async updateOrder(id: string, orderData: any): Promise<Order> {
    const [order] = await db.update(orders).set(orderData).where(eq(orders.id, id)).returning();
    return order;
  }

  async updateOrderItemAllocation(orderId: string, sku: string, allocationData: { quantityAllocated: number, fulfillmentStatus: string }): Promise<void> {
    await db
      .update(orderItems)
      .set({
        quantityAllocated: allocationData.quantityAllocated,
        fulfillmentStatus: allocationData.fulfillmentStatus,
        updatedAt: new Date()
      })
      .where(and(
        eq(orderItems.orderId, orderId),
        eq(orderItems.sku, sku)
      ));
  }

  // Shipment operations
  async getShipmentByShipHeroId(shipHeroShipmentId: string): Promise<Shipment | undefined> {
    const [shipment] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.shipHeroShipmentId, shipHeroShipmentId));
    return shipment;
  }

  async createShipment(shipmentData: InsertShipment): Promise<Shipment> {
    const [shipment] = await db
      .insert(shipments)
      .values(shipmentData)
      .returning();
    return shipment;
  }

  async updateShipment(id: string, shipmentData: Partial<InsertShipment>): Promise<Shipment> {
    const [shipment] = await db
      .update(shipments)
      .set({ ...shipmentData, updatedAt: new Date() })
      .where(eq(shipments.id, id))
      .returning();
    return shipment;
  }

  async getShipmentsByOrder(orderId: string): Promise<Shipment[]> {
    return await db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .orderBy(desc(shipments.createdAt));
  }

  async getShipmentsByBrand(brandId: string): Promise<Shipment[]> {
    return await db
      .select()
      .from(shipments)
      .where(eq(shipments.brandId, brandId))
      .orderBy(desc(shipments.createdAt));
  }

  async updateProduct(id: string, productData: any): Promise<Product> {
    const [product] = await db.update(products).set(productData).where(eq(products.id, id)).returning();
    return product;
  }

  async getBrandsWithShipHeroCredentials(): Promise<Brand[]> {
    return await db.select().from(brands).where(
      and(
        isNotNull(brands.shipHeroApiKey),
        isNotNull(brands.shipHeroPassword),
        eq(brands.isActive, true)
      )
    );
  }
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .leftJoin(threePLs, eq(users.threePlId, threePLs.id))
      .leftJoin(brands, eq(users.brandId, brands.id));
    
    return user?.users;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        role: 'threePL', // Default to 3PL role for signup from landing page
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUsersByBrand(brandId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.brandId, brandId))
      .orderBy(desc(users.createdAt));
  }

  async createBrandUser(userData: any): Promise<User> {
    const [user] = await db.insert(users).values({
      ...userData,
      role: 'brand',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return user;
  }

  async updateBrandUser(userId: string, userData: any): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deleteBrandUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  // New methods for admin dashboard stats
  async getThreePLsCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(threePLs);
    return result[0].count;
  }

  async getBrandsCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(brands);
    return result[0].count;
  }

  async getActiveUsersCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(users);
    return result[0].count;
  }

  async getRecent3PLs(): Promise<ThreePL[]> {
    return await db.select().from(threePLs).orderBy(desc(threePLs.createdAt)).limit(5);
  }

  // New order methods for ShipHero integration
  async getOrderByShipHeroId(shipHeroId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.shipHeroOrderId, shipHeroId));
    return order;
  }

  async updateOrder(id: string, orderData: any): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({
        ...orderData,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  // 3PL operations
  async getThreePL(id: string): Promise<ThreePL | undefined> {
    const [threePL] = await db.select().from(threePLs).where(eq(threePLs.id, id));
    return threePL;
  }

  async createThreePL(threePLData: InsertThreePL): Promise<ThreePL> {
    const [threePL] = await db.insert(threePLs).values(threePLData).returning();
    return threePL;
  }

  async getThreePLs(): Promise<ThreePL[]> {
    return await db.select().from(threePLs).orderBy(desc(threePLs.createdAt));
  }

  // Brand operations
  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand;
  }

  async createBrand(brandData: InsertBrand): Promise<Brand> {
    const [brand] = await db.insert(brands).values(brandData).returning();
    return brand;
  }

  async getBrandsByThreePL(threePlId: string): Promise<any[]> {
    const brandResults = await db
      .select()
      .from(brands)
      .where(eq(brands.threePlId, threePlId))
      .orderBy(desc(brands.createdAt));

    // Transform brands to include integration flags and map snake_case to camelCase
    return brandResults.map(brand => ({
      ...brand,
      status: brand.isActive ? 'active' : 'invited',
      contactEmail: brand.email,
      hasShipHeroIntegration: !!(brand.shipHeroApiKey && brand.shipHeroPassword),
      hasTrackstarIntegration: !!brand.trackstarApiKey,
      shipHeroApiKey: brand.shipHeroApiKey,
      shipHeroPassword: brand.shipHeroPassword ? 'SET' : null,
      // Map Trackstar fields to camelCase for frontend consistency
      trackstarApiKey: brand.trackstarApiKey,
      trackstarAccessToken: brand.trackstarAccessToken,
      trackstarConnectionId: brand.trackstarConnectionId,
      trackstarIntegrationName: brand.trackstarIntegrationName
    }));
  }

  async updateBrandApiCredentials(id: string, apiKey: string, userId: string): Promise<Brand> {
    const [brand] = await db
      .update(brands)
      .set({
        shipHeroApiKey: apiKey,
        shipHeroUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(brands.id, id))
      .returning();
    return brand;
  }

  async updateBrandShipHeroCredentials(id: string, username: string | null, password?: string | null, userId?: string): Promise<Brand> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Update username if provided (can be null to clear)
    if (username !== undefined) {
      updateData.shipHeroApiKey = username;
    }

    // Update password if provided (can be null to clear, undefined to keep current)
    if (password !== undefined) {
      updateData.shipHeroPassword = password;
    }

    // Update user ID if provided
    if (userId !== undefined) {
      updateData.shipHeroUserId = userId;
    }

    const [brand] = await db
      .update(brands)
      .set(updateData)
      .where(eq(brands.id, id))
      .returning();
    return brand;
  }

  async updateBrandTrackstarCredentials(id: string, apiKey: string | null): Promise<Brand> {
    const [brand] = await db
      .update(brands)
      .set({
        trackstarApiKey: apiKey,
        updatedAt: new Date(),
      })
      .where(eq(brands.id, id))
      .returning();
    return brand;
  }

  async getBrandByInvitationToken(token: string): Promise<Brand | undefined> {
    const [brand] = await db
      .select()
      .from(brands)
      .where(eq(brands.invitationToken, token));
    return brand;
  }

  async updateBrandInvitationStatus(id: string, isActive: boolean): Promise<Brand> {
    const [brand] = await db
      .update(brands)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(brands.id, id))
      .returning();
    return brand;
  }

  async updateBrandInvitationToken(id: string, token: string): Promise<Brand> {
    const [brand] = await db
      .update(brands)
      .set({
        invitationToken: token,
        updatedAt: new Date(),
      })
      .where(eq(brands.id, id))
      .returning();
    return brand;
  }

  async getDashboardStatsWithDateRange(userId: string, dateRange?: { start?: Date; end?: Date }, brandId?: string): Promise<any> {
    const user = await this.getUser(userId);
    
    if (!user) {
      return { 
        totalOrders: 0, 
        shippedOrders: 0,
        unfulfilledOrders: 0,
        ordersOnHold: 0,
        openTickets: 0, 
        urgentTickets: 0, 
        lowStockProducts: 0,
        outOfStockProducts: 0
      };
    }

    let brandFilter = user.brandId ? eq(orders.brandId, user.brandId) : undefined;
    let ticketBrandFilter = user.brandId ? eq(tickets.brandId, user.brandId) : undefined;
    let productBrandFilter = user.brandId ? eq(products.brandId, user.brandId) : undefined;

    // Handle brand filtering for 3PL users
    if (user.role === 'threePL' && user.threePlId) {
      if (brandId && brandId !== 'all') {
        // Filter by specific brand
        brandFilter = eq(orders.brandId, brandId);
        ticketBrandFilter = eq(tickets.brandId, brandId);
        productBrandFilter = eq(products.brandId, brandId);
      } else {
        // Show all brands for this 3PL
        const threePlBrands = await this.getBrandsByThreePL(user.threePlId);
        const brandIds = threePlBrands.map(b => b.id);
        
        if (brandIds.length > 0) {
          brandFilter = or(...brandIds.map(id => eq(orders.brandId, id)));
          ticketBrandFilter = or(...brandIds.map(id => eq(tickets.brandId, id)));
          productBrandFilter = or(...brandIds.map(id => eq(products.brandId, id)));
        }
      }
    }

    // Add date filtering for order creation (used for total orders)
    const dateFilter = [];
    if (dateRange?.start) {
      dateFilter.push(gte(orders.orderCreatedAt, dateRange.start));
    }
    if (dateRange?.end) {
      dateFilter.push(lte(orders.orderCreatedAt, dateRange.end));
    }

    // Add date filtering for fulfilled orders based on ship date
    // Use shippedAt if available, otherwise fall back to orderCreatedAt
    const fulfilledDateFilter = [];
    if (dateRange?.start) {
      fulfilledDateFilter.push(
        or(
          and(isNotNull(orders.shippedAt), gte(orders.shippedAt, dateRange.start)),
          and(isNull(orders.shippedAt), gte(orders.orderCreatedAt, dateRange.start))
        )
      );
    }
    if (dateRange?.end) {
      fulfilledDateFilter.push(
        or(
          and(isNotNull(orders.shippedAt), lte(orders.shippedAt, dateRange.end)),
          and(isNull(orders.shippedAt), lte(orders.orderCreatedAt, dateRange.end))
        )
      );
    }

    const orderFilters = [brandFilter, ...dateFilter].filter(Boolean);
    const finalOrderFilter = orderFilters.length > 0 ? and(...orderFilters) : undefined;

    // Total orders
    const [totalOrdersResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(finalOrderFilter);

    // Fulfilled orders - filter by ship/delivery date, not order creation date
    let fulfilledWhere = eq(orders.status, 'fulfilled');
    if (brandFilter) {
      fulfilledWhere = and(brandFilter, fulfilledWhere);
    }
    if (fulfilledDateFilter.length > 0) {
      fulfilledWhere = and(and(...fulfilledDateFilter), fulfilledWhere);
    }
    const [fulfilledOrdersResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(fulfilledWhere);

    // Unfulfilled orders - All orders that are NOT fulfilled (per ShipHero logic)
    // ShipHero: All shipped orders have status='fulfilled', unfulfilled orders have various statuses
    let unfulfilledWhere = ne(orders.status, 'fulfilled');
    if (brandFilter) {
      unfulfilledWhere = and(brandFilter, unfulfilledWhere);
    }
    // Note: Intentionally NOT applying date filter to unfulfilled orders
    const [unfulfilledOrdersResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(unfulfilledWhere);

    // Orders on hold - NOT fulfilled AND have operator hold conditions
    // Look for: status='on_hold', fulfillment_status contains 'hold'/'operator', or hold_until_date set
    let ordersOnHoldWhere = and(
      ne(orders.status, 'fulfilled'), // Not fulfilled
      or(
        eq(orders.status, 'on_hold'),
        isNotNull(orders.holdUntilDate),
        like(orders.fulfillmentStatus, '%hold%'),
        like(orders.fulfillmentStatus, '%operator%'),
        like(orders.fulfillmentStatus, '%Operator%')
      )
    );
    if (brandFilter) {
      ordersOnHoldWhere = and(brandFilter, ordersOnHoldWhere);
    }
    const [ordersOnHoldResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(ordersOnHoldWhere);

    // Open tickets
    const [openTicketsResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(
        ticketBrandFilter,
        eq(tickets.status, 'open')
      ));

    // Urgent tickets
    const [urgentTicketsResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(
        ticketBrandFilter,
        eq(tickets.priority, 'urgent'),
        eq(tickets.status, 'open')
      ));

    // Low stock products (inventory < 10 or custom threshold)
    const [lowStockResult] = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        productBrandFilter,
        // Use lowStockThreshold if available, otherwise default to 10
        or(
          and(isNotNull(products.lowStockThreshold), lt(products.inventoryCount, products.lowStockThreshold)),
          and(isNull(products.lowStockThreshold), lt(products.inventoryCount, 10))
        )
      ));

    // Out of stock products
    const [outOfStockResult] = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        productBrandFilter,
        eq(products.inventoryCount, 0)
      ));

    console.log("📊 DASHBOARD STATS DEBUG:");
    console.log("Total Orders:", totalOrdersResult?.count || 0);  
    console.log("Fulfilled Orders:", fulfilledOrdersResult?.count || 0);
    console.log("Unfulfilled Orders:", unfulfilledOrdersResult?.count || 0);
    console.log("Orders on Hold:", ordersOnHoldResult?.count || 0);
    console.log("Date range:", JSON.stringify(dateRange));
    console.log("Brand filter applied:", !!brandFilter);
    console.log("User role:", user?.role);
    console.log("User brand ID:", user?.brandId);

    return {
      totalOrders: totalOrdersResult?.count || 0,
      shippedOrders: fulfilledOrdersResult?.count || 0,
      unfulfilledOrders: unfulfilledOrdersResult?.count || 0,
      ordersOnHold: ordersOnHoldResult?.count || 0,
      openTickets: openTicketsResult?.count || 0,
      urgentTickets: urgentTicketsResult?.count || 0,
      lowStockProducts: lowStockResult?.count || 0,
      outOfStockProducts: outOfStockResult?.count || 0,
    };
  }

  async updateThreePlTrackstarApiKey(id: string, apiKey: string): Promise<ThreePL> {
    const [threePL] = await db
      .update(threePLs)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(threePLs.id, id))
      .returning();
    return threePL;
  }

  // Order operations
  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  // Get order with its line items from the normalized table
  async getOrderWithItems(id: string): Promise<Order & { orderItemsNormalized?: OrderItem[] } | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    
    return {
      ...order,
      orderItemsNormalized: items
    };
  }

  // Get orders with their line items (for better performance on listing pages)
  async getOrdersWithItems(filters?: { brandId?: string; threePlId?: string; limit?: number }): Promise<(Order & { orderItemsNormalized?: OrderItem[] })[]> {
    let query = db.select().from(orders);
    
    if (filters?.brandId) {
      query = query.where(eq(orders.brandId, filters.brandId));
    } else if (filters?.threePlId) {
      query = query
        .leftJoin(brands, eq(orders.brandId, brands.id))
        .where(eq(brands.threePlId, filters.threePlId));
    }
    
    query = query.orderBy(desc(orders.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    const ordersResult = await query;
    
    // Get all order items for these orders
    const orderIds = ordersResult.map(o => o.id);
    const allItems = orderIds.length > 0 
      ? await db.select().from(orderItems).where(or(...orderIds.map(id => eq(orderItems.orderId, id))))
      : [];
    
    // Group items by order ID
    const itemsByOrder = allItems.reduce((acc, item) => {
      if (!acc[item.orderId]) acc[item.orderId] = [];
      acc[item.orderId].push(item);
      return acc;
    }, {} as Record<string, OrderItem[]>);
    
    return ordersResult.map(order => ({
      ...order,
      orderItemsNormalized: itemsByOrder[order.id] || []
    }));
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    console.log("🔍 STORAGE: Creating order with data:", JSON.stringify(orderData, null, 2));
    
    try {
      // Extract orderItems from orderData (if it exists as legacy JSON)
      const { orderItems: legacyOrderItems, ...orderDataWithoutItems } = orderData;
      
      // Create the order first
      const [order] = await db.insert(orders).values(orderDataWithoutItems).returning();
      console.log("✅ STORAGE: Order created with ID:", order.id);
      
      // If there are legacy order items in JSON format, save them to the order_items table
      if (legacyOrderItems && Array.isArray(legacyOrderItems)) {
        const orderItemsToInsert = legacyOrderItems.map((item: any) => ({
          orderId: order.id,
          shipHeroLineItemId: item.id || null,
          sku: item.sku || '',
          productName: item.productName || item.title || item.name || 'Unknown Product',
          quantity: parseInt(item.quantity) || 1,
          quantityAllocated: parseInt(item.quantityAllocated) || parseInt(item.quantity_allocated) || 0,
          quantityShipped: parseInt(item.quantityShipped) || parseInt(item.quantity_shipped) || 0,
          backorderQuantity: parseInt(item.backorderQuantity) || parseInt(item.backorder_quantity) || 0,
          unitPrice: parseFloat(item.price) || 0,
          totalPrice: (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1),
          fulfillmentStatus: item.fulfillmentStatus || item.fulfillment_status || 'pending',
          warehouseId: item.warehouseId || null
        }));
        
        if (orderItemsToInsert.length > 0) {
          await db.insert(orderItems).values(orderItemsToInsert);
          console.log(`✅ STORAGE: Created ${orderItemsToInsert.length} order items for order ${order.id}`);
        }
      }
      
      return order;
    } catch (error) {
      console.error("❌ STORAGE: Order creation failed:", error);
      console.error("❌ STORAGE: Stack trace:", error.stack);
      throw error;
    }
  }

  async getOrdersByBrand(brandId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.brandId, brandId))
      .orderBy(desc(orders.createdAt));
  }

  // Get brand orders with normalized items  
  async getOrdersByBrandWithItems(brandId: string): Promise<(Order & { orderItemsNormalized?: OrderItem[] })[]> {
    return this.getOrdersWithItems({ brandId });
  }

  async getOrdersByThreePL(threePlId: string): Promise<Order[]> {
    return await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        brandId: orders.brandId,
        customerName: orders.customerName,
        customerEmail: orders.customerEmail,
        shippingAddress: orders.shippingAddress,
        billingAddress: orders.billingAddress,
        status: orders.status,
        totalAmount: orders.totalAmount,
        shippingMethod: orders.shippingMethod,
        trackingNumber: orders.trackingNumber,
        shipHeroOrderId: orders.shipHeroOrderId,
        orderItems: orders.orderItems,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        lastSyncAt: orders.lastSyncAt,
      })
      .from(orders)
      .leftJoin(brands, eq(orders.brandId, brands.id))
      .where(eq(brands.threePlId, threePlId))
      .orderBy(desc(orders.createdAt));
  }

  // Get 3PL orders with normalized items
  async getOrdersByThreePLWithItems(threePlId: string): Promise<(Order & { orderItemsNormalized?: OrderItem[] })[]> {
    return this.getOrdersWithItems({ threePlId });
  }

  async getAllOrders(): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async updateOrderShipping(id: string, address: any, method?: string): Promise<Order> {
    const updateData: any = { shippingAddress: address, updatedAt: new Date() };
    if (method) updateData.shippingMethod = method;
    
    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  // Product operations
  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    console.log("🔍 STORAGE: Creating product with data:", JSON.stringify(productData, null, 2));
    
    try {
      const [product] = await db.insert(products).values(productData).returning();
      console.log("✅ STORAGE: Product created with ID:", product.id);
      return product;
    } catch (error) {
      console.error("❌ STORAGE: Product creation failed:", error);
      console.error("❌ STORAGE: Stack trace:", error.stack);
      throw error;
    }
  }

  async getProductsByBrand(brandId: string): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.brandId, brandId))
      .orderBy(desc(products.createdAt));
  }

  async getProductsByThreePL(threePlId: string): Promise<Product[]> {
    return await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        brandId: products.brandId,
        price: products.price,
        inventoryCount: products.inventoryCount,
        shipHeroProductId: products.shipHeroProductId,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        lastSyncAt: products.lastSyncAt,
        weight: products.weight,
        dimensions: products.dimensions,
        barcode: products.barcode,
        hsCode: products.hsCode,
        countryOfOrigin: products.countryOfOrigin,
        reservedQuantity: products.reservedQuantity,
        lowStockThreshold: products.lowStockThreshold,
        brandName: brands.name,
      })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(eq(brands.threePlId, threePlId))
      .orderBy(desc(products.createdAt));
  }

  async getAllProducts(): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt));
  }

  async updateProductInventory(id: string, count: number): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ inventoryCount: count, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async getProductsWithWarehouseByBrand(brandId: string): Promise<any[]> {
    const result = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        brandId: products.brandId,
        price: products.price,
        inventoryCount: products.inventoryCount,
        shipHeroProductId: products.shipHeroProductId,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        lastSyncAt: products.lastSyncAt,
        weight: products.weight,
        dimensions: products.dimensions,
        barcode: products.barcode,
        hsCode: products.hsCode,
        countryOfOrigin: products.countryOfOrigin,
        reservedQuantity: products.reservedQuantity,
        lowStockThreshold: products.lowStockThreshold,
        // Warehouse data
        warehouseId: productWarehouse.warehouseId,
        warehouseName: productWarehouse.warehouseName,
        onHand: productWarehouse.onHand,
        available: productWarehouse.available,
        allocated: productWarehouse.allocated,
        reserved: productWarehouse.reserved,
        lastWarehouseSync: productWarehouse.lastSyncAt,
      })
      .from(products)
      .leftJoin(productWarehouse, eq(products.id, productWarehouse.productId))
      .where(eq(products.brandId, brandId))
      .orderBy(desc(products.createdAt));

    // Group products with their warehouse data
    const grouped = result.reduce((acc, row) => {
      const existing = acc.find(p => p.id === row.id);
      if (existing) {
        if (row.warehouseId) {
          existing.warehouses.push({
            warehouseId: row.warehouseId,
            warehouseName: row.warehouseName,
            onHand: row.onHand,
            available: row.available,
            allocated: row.allocated,
            reserved: row.reserved,
            lastSyncAt: row.lastWarehouseSync,
          });
        }
      } else {
        const { warehouseId, warehouseName, onHand, available, allocated, reserved, lastWarehouseSync, ...productData } = row;
        acc.push({
          ...productData,
          warehouses: warehouseId ? [{
            warehouseId,
            warehouseName,
            onHand,
            available,
            allocated,
            reserved,
            lastSyncAt: lastWarehouseSync,
          }] : [],
        });
      }
      return acc;
    }, [] as any[]);

    return grouped;
  }

  async getProductsWithWarehouseByThreePL(threePlId: string): Promise<any[]> {
    const result = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        brandId: products.brandId,
        price: products.price,
        inventoryCount: products.inventoryCount,
        shipHeroProductId: products.shipHeroProductId,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        lastSyncAt: products.lastSyncAt,
        weight: products.weight,
        dimensions: products.dimensions,
        barcode: products.barcode,
        hsCode: products.hsCode,
        countryOfOrigin: products.countryOfOrigin,
        reservedQuantity: products.reservedQuantity,
        lowStockThreshold: products.lowStockThreshold,
        brandName: brands.name,
        // Warehouse data
        warehouseId: productWarehouse.warehouseId,
        warehouseName: productWarehouse.warehouseName,
        onHand: productWarehouse.onHand,
        available: productWarehouse.available,
        allocated: productWarehouse.allocated,
        reserved: productWarehouse.reserved,
        lastWarehouseSync: productWarehouse.lastSyncAt,
      })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(productWarehouse, eq(products.id, productWarehouse.productId))
      .where(eq(brands.threePlId, threePlId))
      .orderBy(desc(products.createdAt));

    // Group products with their warehouse data
    const grouped = result.reduce((acc, row) => {
      const existing = acc.find(p => p.id === row.id);
      if (existing) {
        if (row.warehouseId) {
          existing.warehouses.push({
            warehouseId: row.warehouseId,
            warehouseName: row.warehouseName,
            onHand: row.onHand,
            available: row.available,
            allocated: row.allocated,
            reserved: row.reserved,
            lastSyncAt: row.lastWarehouseSync,
          });
        }
      } else {
        const { warehouseId, warehouseName, onHand, available, allocated, reserved, lastWarehouseSync, ...productData } = row;
        acc.push({
          ...productData,
          warehouses: warehouseId ? [{
            warehouseId,
            warehouseName,
            onHand,
            available,
            allocated,
            reserved,
            lastSyncAt: lastWarehouseSync,
          }] : [],
        });
      }
      return acc;
    }, [] as any[]);

    return grouped;
  }

  async getWarehousesByBrand(brandId: string): Promise<any[]> {
    return await db
      .select({
        warehouseId: productWarehouse.warehouseId,
        warehouseName: productWarehouse.warehouseName,
      })
      .from(productWarehouse)
      .leftJoin(products, eq(productWarehouse.productId, products.id))
      .where(eq(products.brandId, brandId))
      .groupBy(productWarehouse.warehouseId, productWarehouse.warehouseName)
      .orderBy(productWarehouse.warehouseName);
  }

  async getWarehousesByThreePL(threePlId: string): Promise<any[]> {
    return await db
      .select({
        warehouseId: productWarehouse.warehouseId,
        warehouseName: productWarehouse.warehouseName,
      })
      .from(productWarehouse)
      .leftJoin(products, eq(productWarehouse.productId, products.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(eq(brands.threePlId, threePlId))
      .groupBy(productWarehouse.warehouseId, productWarehouse.warehouseName)
      .orderBy(productWarehouse.warehouseName);
  }

  // Warehouse inventory operations
  async upsertProductWarehouse(productWarehouseData: InsertProductWarehouse): Promise<ProductWarehouse> {
    console.log("🏭 STORAGE: Upserting product warehouse data:", productWarehouseData);
    
    try {
      const [productWarehouseRecord] = await db
        .insert(productWarehouse)
        .values(productWarehouseData)
        .onConflictDoUpdate({
          target: [productWarehouse.productId, productWarehouse.warehouseId],
          set: {
            ...productWarehouseData,
            updatedAt: new Date(),
          },
        })
        .returning();
      
      console.log("✅ STORAGE: Product warehouse record upserted for product:", productWarehouseRecord.productId);
      return productWarehouseRecord;
    } catch (error) {
      console.error("❌ STORAGE: Product warehouse upsert failed:", error);
      throw error;
    }
  }

  async getProductWarehouseInventory(productId: string): Promise<ProductWarehouse[]> {
    return await db
      .select()
      .from(productWarehouse)
      .where(eq(productWarehouse.productId, productId));
  }

  async getWarehouseInventoryByBrand(brandId: string): Promise<{ product: Product; warehouses: ProductWarehouse[] }[]> {
    // Get all products for this brand with their warehouse inventory
    const productsWithWarehouses = await db
      .select({
        product: products,
        warehouse: productWarehouse,
      })
      .from(products)
      .leftJoin(productWarehouse, eq(products.id, productWarehouse.productId))
      .where(eq(products.brandId, brandId));

    // Group by product
    const grouped = productsWithWarehouses.reduce((acc, row) => {
      const productId = row.product.id;
      if (!acc[productId]) {
        acc[productId] = {
          product: row.product,
          warehouses: [],
        };
      }
      if (row.warehouse) {
        acc[productId].warehouses.push(row.warehouse);
      }
      return acc;
    }, {} as Record<string, { product: Product; warehouses: ProductWarehouse[] }>);

    return Object.values(grouped);
  }

  // Ticket operations
  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }

  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    // Generate ticket number
    const ticketCount = await db.select({ count: count() }).from(tickets);
    const ticketNumber = `TK-${String(ticketCount[0].count + 1).padStart(6, '0')}`;
    
    const [ticket] = await db
      .insert(tickets)
      .values({ ...ticketData, ticketNumber })
      .returning();
    return ticket;
  }

  async getTicketsByUser(userId: string): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(or(eq(tickets.createdById, userId), eq(tickets.assignedToId, userId)))
      .orderBy(desc(tickets.createdAt));
  }

  async getTicketsByBrand(brandId: string): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(eq(tickets.brandId, brandId))
      .orderBy(desc(tickets.createdAt));
  }

  async getTicketsByThreePL(threePlId: string): Promise<Ticket[]> {
    return await db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        priority: tickets.priority,
        createdById: tickets.createdById,
        assignedToId: tickets.assignedToId,
        brandId: tickets.brandId,
        threePlId: tickets.threePlId,
        orderId: tickets.orderId,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        brandName: brands.name,
      })
      .from(tickets)
      .leftJoin(brands, eq(tickets.brandId, brands.id))
      .where(eq(tickets.threePlId, threePlId))
      .orderBy(desc(tickets.createdAt));
  }

  async updateTicketStatus(id: string, status: string): Promise<Ticket> {
    const [ticket] = await db
      .update(tickets)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return ticket;
  }

  async getTicketsWithComments(filters?: { status?: string; priority?: string; brandId?: string }): Promise<any[]> {
    let whereConditions = [];
    
    if (filters?.status) {
      whereConditions.push(eq(tickets.status, filters.status as any));
    }
    if (filters?.priority) {
      whereConditions.push(eq(tickets.priority, filters.priority as any));
    }
    if (filters?.brandId) {
      whereConditions.push(eq(tickets.brandId, filters.brandId));
    }

    const query = db
      .select({
        ticket: tickets,
        createdBy: users,
        brand: brands,
        order: orders,
        commentCount: count(ticketComments.id),
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.createdById, users.id))
      .leftJoin(brands, eq(tickets.brandId, brands.id))
      .leftJoin(orders, eq(tickets.orderId, orders.id))
      .leftJoin(ticketComments, eq(tickets.id, ticketComments.ticketId))
      .groupBy(tickets.id, users.id, brands.id, orders.id)
      .orderBy(desc(tickets.createdAt));

    if (whereConditions.length > 0) {
      return await query.where(and(...whereConditions));
    }
    
    return await query;
  }



  // Comment operations
  async createComment(commentData: InsertTicketComment): Promise<TicketComment> {
    const [comment] = await db.insert(ticketComments).values(commentData).returning();
    return comment;
  }

  async getCommentsByTicket(ticketId: string): Promise<TicketComment[]> {
    return await db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.ticketId, ticketId))
      .orderBy(ticketComments.createdAt);
  }

  // Attachment operations
  async createAttachment(attachmentData: InsertAttachment): Promise<Attachment> {
    const [attachment] = await db.insert(attachments).values(attachmentData).returning();
    return attachment;
  }

  // Brand operations
  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand;
  }

  // Order update operations
  async updateOrder(id: string, updateData: any): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  // Get sync status for a brand
  async getSyncStatus(brandId: string): Promise<any[]> {
    return await db
      .select()
      .from(syncStatus)
      .where(eq(syncStatus.brandId, brandId))
      .orderBy(desc(syncStatus.updatedAt));
  }

  async updateSyncStatus(brandId: string, syncType: string, status: string, recordsProcessed: number, errorMessage?: string): Promise<void> {
    const now = new Date();
    
    // Check if sync status record exists
    const [existingStatus] = await db
      .select()
      .from(syncStatus)
      .where(and(eq(syncStatus.brandId, brandId), eq(syncStatus.syncType, syncType)));

    if (existingStatus) {
      // Update existing record
      await db
        .update(syncStatus)
        .set({
          lastSyncAt: now,
          lastSyncStatus: status,
          recordsProcessed,
          errorCount: status === 'error' ? (existingStatus.errorCount || 0) + 1 : 0,
          errorDetails: errorMessage ? { message: errorMessage, timestamp: now } : null,
          updatedAt: now,
        })
        .where(eq(syncStatus.id, existingStatus.id));
    } else {
      // Create new record
      await db.insert(syncStatus).values({
        brandId,
        syncType,
        lastSyncAt: now,
        lastSyncStatus: status,
        recordsProcessed,
        errorCount: status === 'error' ? 1 : 0,
        errorDetails: errorMessage ? { message: errorMessage, timestamp: now } : null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async getAttachmentsByTicket(ticketId: string): Promise<Attachment[]> {
    return await db
      .select()
      .from(attachments)
      .where(eq(attachments.ticketId, ticketId))
      .orderBy(desc(attachments.createdAt));
  }

  // Dashboard stats operations
  async getTotalOrdersCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(orders);
    return result[0].count;
  }

  async getTotalOrdersCountByBrand(brandId: string): Promise<number> {
    const result = await db.select({ count: count() }).from(orders).where(eq(orders.brandId, brandId));
    return result[0].count;
  }

  async getTotalOrdersCountByThreePL(threePlId: string): Promise<number> {
    const result = await db
      .select({ count: count(orders.id) })
      .from(orders)
      .leftJoin(brands, eq(orders.brandId, brands.id))
      .where(eq(brands.threePlId, threePlId));
    return result[0].count;
  }

  async getOpenTicketsCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(tickets).where(eq(tickets.status, 'open'));
    return result[0].count;
  }

  async getOpenTicketsCountByBrand(brandId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(eq(tickets.status, 'open'), eq(tickets.brandId, brandId)));
    return result[0].count;
  }

  async getOpenTicketsCountByThreePL(threePlId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(eq(tickets.status, 'open'), eq(tickets.threePlId, threePlId)));
    return result[0].count;
  }

  async getUrgentTicketsCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(tickets).where(eq(tickets.priority, 'urgent'));
    return result[0].count;
  }

  async getUrgentTicketsCountByBrand(brandId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(eq(tickets.priority, 'urgent'), eq(tickets.brandId, brandId)));
    return result[0].count;
  }

  async getUrgentTicketsCountByThreePL(threePlId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(eq(tickets.priority, 'urgent'), eq(tickets.threePlId, threePlId)));
    return result[0].count;
  }

  async getPendingOrdersCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(orders).where(eq(orders.status, 'pending'));
    return result[0].count;
  }

  async getPendingOrdersCountByBrand(brandId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(orders)
      .where(and(eq(orders.status, 'pending'), eq(orders.brandId, brandId)));
    return result[0].count;
  }

  async getPendingOrdersCountByThreePL(threePlId: string): Promise<number> {
    const result = await db
      .select({ count: count(orders.id) })
      .from(orders)
      .leftJoin(brands, eq(orders.brandId, brands.id))
      .where(and(eq(orders.status, 'pending'), eq(brands.threePlId, threePlId)));
    return result[0].count;
  }
}

export const storage = new DatabaseStorage();
