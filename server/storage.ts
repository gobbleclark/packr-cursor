import {
  users,
  threePLs,
  brands,
  orders,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, count, isNull, isNotNull } from "drizzle-orm";

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
  updateBrandTrackstarCredentials(id: string, apiKey: string): Promise<Brand>;
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
  
  // Product operations
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  getProductsByBrand(brandId: string): Promise<Product[]>;
  updateProductInventory(id: string, count: number): Promise<Product>;
  
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

    // Transform brands to include hasShipHeroIntegration flag
    return brandResults.map(brand => ({
      ...brand,
      status: brand.isActive ? 'active' : 'invited',
      contactEmail: brand.email,
      hasShipHeroIntegration: !!(brand.shipHeroApiKey && brand.shipHeroPassword),
      hasTrackstarIntegration: !!brand.trackstarApiKey,
      shipHeroApiKey: brand.shipHeroApiKey,
      // Also map the database column names to the expected API format
      shipHeroPassword: brand.shipHeroPassword ? 'SET' : null
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

  async updateBrandTrackstarCredentials(id: string, apiKey: string): Promise<Brand> {
    const [brand] = await db
      .update(brands)
      .set({
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

  async getDashboardStats(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    
    if (!user) {
      return { totalOrders: 0, openTickets: 0, urgentTickets: 0, lowInventoryItems: 0 };
    }

    let brandFilter = user.brandId ? eq(orders.brandId, user.brandId) : undefined;
    let ticketBrandFilter = user.brandId ? eq(tickets.brandId, user.brandId) : undefined;
    let productBrandFilter = user.brandId ? eq(products.brandId, user.brandId) : undefined;

    // If user is a 3PL, get stats for all their brands
    if (user.role === 'threePL' && user.threePlId) {
      const threePlBrands = await this.getBrandsByThreePL(user.threePlId);
      const brandIds = threePlBrands.map(b => b.id);
      
      if (brandIds.length > 0) {
        brandFilter = or(...brandIds.map(id => eq(orders.brandId, id)));
        ticketBrandFilter = or(...brandIds.map(id => eq(tickets.brandId, id)));
        productBrandFilter = or(...brandIds.map(id => eq(products.brandId, id)));
      }
    }

    const [totalOrdersResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(brandFilter);

    const [openTicketsResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(
        ticketBrandFilter,
        eq(tickets.status, 'open')
      ));

    const [urgentTicketsResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(
        ticketBrandFilter,
        eq(tickets.priority, 'urgent'),
        eq(tickets.status, 'open')
      ));

    const [lowInventoryResult] = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        productBrandFilter,
        // Consider items with inventory < 10 as low stock
        // Note: This is a simplified version, you might want to add a lowStockThreshold field
      ));

    return {
      totalOrders: totalOrdersResult?.count || 0,
      openTickets: openTicketsResult?.count || 0,
      urgentTickets: urgentTicketsResult?.count || 0,
      lowInventoryItems: lowInventoryResult?.count || 0,
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

  async createOrder(orderData: InsertOrder): Promise<Order> {
    console.log("🔍 STORAGE: Creating order with data:", JSON.stringify(orderData, null, 2));
    
    try {
      const [order] = await db.insert(orders).values(orderData).returning();
      console.log("✅ STORAGE: Order created with ID:", order.id);
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
