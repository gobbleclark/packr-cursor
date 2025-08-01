import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertBrandSchema, 
  insertTicketSchema, 
  insertTicketCommentSchema,
  insertOrderSchema,
  insertProductSchema 
} from "@shared/schema";
import { ShipHeroService } from "./services/shiphero";
import { TrackstarService } from "./services/trackstar";
import { BackgroundJobService } from "./services/backgroundJobs";
import { sendBrandInvitationEmail } from "./services/emailService";
import { nanoid } from "nanoid";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

interface AuthenticatedRequest extends Request {
  user?: any;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Initialize services
  const shipHeroService = new ShipHeroService();
  const trackstarService = new TrackstarService();
  const backgroundJobService = new BackgroundJobService(storage, shipHeroService);
  
  // Start background jobs
  backgroundJobService.startOrderSync();
  backgroundJobService.startInventorySync();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let stats = {
        totalOrders: 0,
        openTickets: 0,
        urgentTickets: 0,
        pendingOrders: 0,
        recentActivity: []
      };
      
      if (user.role === 'brand' && user.brandId) {
        stats.totalOrders = await storage.getTotalOrdersCountByBrand(user.brandId);
        stats.openTickets = await storage.getOpenTicketsCountByBrand(user.brandId);
        stats.urgentTickets = await storage.getUrgentTicketsCountByBrand(user.brandId);
        stats.pendingOrders = await storage.getPendingOrdersCountByBrand(user.brandId);
      } else if (user.role === 'threePL' && user.threePlId) {
        stats.totalOrders = await storage.getTotalOrdersCountByThreePL(user.threePlId);
        stats.openTickets = await storage.getOpenTicketsCountByThreePL(user.threePlId);
        stats.urgentTickets = await storage.getUrgentTicketsCountByThreePL(user.threePlId);
        stats.pendingOrders = await storage.getPendingOrdersCountByThreePL(user.threePlId);
      } else {
        stats.totalOrders = await storage.getTotalOrdersCount();
        stats.openTickets = await storage.getOpenTicketsCount();
        stats.urgentTickets = await storage.getUrgentTicketsCount();
        stats.pendingOrders = await storage.getPendingOrdersCount();
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // 3PL routes
  app.get('/api/three-pls', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const threePLs = await storage.getThreePLs();
      res.json(threePLs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch 3PLs" });
    }
  });

  app.post('/api/three-pls', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const threePLData = req.body;
      const threePL = await storage.createThreePL(threePLData);
      res.json(threePL);
    } catch (error) {
      res.status(500).json({ message: "Failed to create 3PL" });
    }
  });

  // Brand routes
  app.get('/api/brands', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === 'threePL' && user.threePlId) {
        const brands = await storage.getBrandsByThreePL(user.threePlId);
        res.json(brands);
      } else if (user?.role === 'admin') {
        // Admin can see all brands - would need to implement this
        res.json([]);
      } else if (user?.brandId) {
        const brand = await storage.getBrand(user.brandId);
        res.json(brand ? [brand] : []);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch brands" });
    }
  });

  app.post('/api/brands', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const brandData = insertBrandSchema.parse(req.body);
      const brand = await storage.createBrand(brandData);
      res.json(brand);
    } catch (error) {
      res.status(500).json({ message: "Failed to create brand" });
    }
  });

  app.put('/api/brands/:id/api-credentials', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { apiKey, userId } = req.body;
      
      const brand = await storage.updateBrandApiCredentials(id, apiKey, userId);
      res.json(brand);
    } catch (error) {
      res.status(500).json({ message: "Failed to update API credentials" });
    }
  });

  // Brand invitation route
  app.post('/api/brands/invite', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'threePL' || !user.threePlId) {
        return res.status(403).json({ message: "Only 3PL managers can invite brands" });
      }

      const { name, email } = req.body;
      const invitationToken = nanoid(32);
      
      const brandData = {
        name,
        email,
        threePlId: user.threePlId,
        invitationToken,
        invitationSentAt: new Date(),
        isActive: false, // Will be activated when they accept invitation
      };

      const brand = await storage.createBrand(brandData);
      
      // Send invitation email to the brand
      const invitationLink = `${req.protocol}://${req.get('host')}/invite/${invitationToken}`;
      const threePL = await storage.getThreePL(user.threePlId);
      
      try {
        const emailSent = await sendBrandInvitationEmail(
          name,
          email,
          invitationLink,
          threePL?.name || '3PL Company'
        );
        
        if (emailSent) {
          res.json({ 
            brand, 
            invitationLink,
            message: "Brand invitation created and email sent successfully!"
          });
        } else {
          res.json({ 
            brand, 
            invitationLink,
            message: "Brand invitation created, but email failed to send. Please share the invitation link manually.",
            emailFailed: true
          });
        }
      } catch (emailError) {
        console.error("Error sending invitation email:", emailError);
        res.json({ 
          brand, 
          invitationLink,
          message: "Brand invitation created, but email failed to send. Please share the invitation link manually.",
          emailFailed: true
        });
      }
    } catch (error) {
      console.error("Error creating brand invitation:", error);
      res.status(500).json({ message: "Failed to create brand invitation" });
    }
  });

  // Accept brand invitation route (public)
  app.get('/api/brands/invite/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const brand = await storage.getBrandByInvitationToken(token);
      
      if (!brand) {
        return res.status(404).json({ message: "Invalid invitation token" });
      }
      
      res.json({ brand: { id: brand.id, name: brand.name, email: brand.email } });
    } catch (error) {
      console.error("Error validating invitation:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  app.post('/api/brands/invite/:token/accept', async (req, res) => {
    try {
      const { token } = req.params;
      const brand = await storage.getBrandByInvitationToken(token);
      
      if (!brand) {
        return res.status(404).json({ message: "Invalid invitation token" });
      }
      
      // Activate the brand
      await storage.updateBrandInvitationStatus(brand.id, true);
      
      res.json({ 
        message: "Invitation accepted successfully. You can now sign in to access your dashboard.",
        brandId: brand.id
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Resend brand invitation route
  app.post('/api/brands/:brandId/resend-invite', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { brandId } = req.params;
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Check if user is 3PL and has access to this brand
      if (user?.role !== 'threePL' || !user.threePlId) {
        return res.status(403).json({ message: "Only 3PL managers can resend invitations" });
      }
      
      const brand = await storage.getBrand(brandId);
      if (!brand || brand.threePlId !== user.threePlId) {
        return res.status(404).json({ message: "Brand not found or access denied" });
      }
      
      if (brand.isActive) {
        return res.status(400).json({ message: "Brand is already active - no need to resend invitation" });
      }
      
      // Generate new invitation token and link
      const invitationToken = crypto.randomBytes(32).toString('hex');
      await storage.updateBrandInvitationToken(brandId, invitationToken);
      
      const invitationLink = `${req.protocol}://${req.hostname}/brand-invite/${invitationToken}`;
      
      // Send invitation email
      try {
        const threePLCompany = await storage.getThreePL(user.threePlId);
        const emailSent = await sendBrandInvitationEmail(
          brand.email,
          brand.name,
          threePLCompany?.name || "Your 3PL Partner",
          invitationLink
        );
        
        if (emailSent) {
          res.json({ 
            message: "Brand invitation resent successfully!",
            invitationLink
          });
        } else {
          res.json({ 
            message: "Invitation updated, but email failed to send. Please share the invitation link manually.",
            invitationLink,
            emailFailed: true
          });
        }
      } catch (emailError) {
        console.error("Error sending resend invitation email:", emailError);
        res.json({ 
          message: "Invitation updated, but email failed to send. Please share the invitation link manually.",
          invitationLink,
          emailFailed: true
        });
      }
    } catch (error) {
      console.error("Error resending brand invitation:", error);
      res.status(500).json({ message: "Failed to resend brand invitation" });
    }
  });



  // Trackstar integration routes
  app.post('/api/trackstar/link-token', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const trackstarService = new TrackstarService();
      const linkToken = await trackstarService.getLinkToken();
      
      res.json({ linkToken });
    } catch (error) {
      console.error("Error getting Trackstar link token:", error);
      res.status(500).json({ message: "Failed to get Trackstar link token" });
    }
  });

  app.post('/api/trackstar/exchange', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { authCode, brandId } = req.body;
      
      const trackstarService = new TrackstarService();
      const tokenData = await trackstarService.exchangeAuthCode(authCode);
      
      // Update brand with Trackstar credentials
      await storage.updateBrandTrackstarCredentials(
        brandId,
        tokenData.access_token,
        tokenData.connection_id,
        tokenData.integration_name
      );
      
      res.json({ 
        message: "Trackstar integration connected successfully",
        integrationName: tokenData.integration_name
      });
    } catch (error) {
      console.error("Error exchanging Trackstar auth code:", error);
      res.status(500).json({ message: "Failed to connect Trackstar integration" });
    }
  });

  app.post('/api/trackstar/sync/:brandId', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { brandId } = req.params;
      const { syncType } = req.body; // 'inventory' or 'orders'
      
      const brand = await storage.getBrand(brandId);
      if (!brand?.trackstarAccessToken || !brand?.trackstarConnectionId) {
        return res.status(400).json({ message: "Trackstar not configured for this brand" });
      }

      // Using universal Trackstar API key - no need to check 3PL specific key

      const trackstarService = new TrackstarService();
      
      let result;
      if (syncType === 'inventory') {
        result = await trackstarService.syncInventoryForBrand(
          brand.trackstarAccessToken,
          brand.trackstarConnectionId
        );
      } else if (syncType === 'orders') {
        result = await trackstarService.syncOrdersForBrand(
          brand.trackstarAccessToken,
          brand.trackstarConnectionId
        );
      } else {
        return res.status(400).json({ message: "Invalid sync type. Use 'inventory' or 'orders'" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error syncing Trackstar data:", error);
      res.status(500).json({ message: "Failed to sync Trackstar data" });
    }
  });

  // Order routes
  app.get('/api/orders', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === 'brand' && user.brandId) {
        const orders = await storage.getOrdersByBrand(user.brandId);
        res.json(orders);
      } else if (user?.role === 'threePL' && user.threePlId) {
        const orders = await storage.getOrdersByThreePL(user.threePlId);
        res.json(orders);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.post('/api/orders', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.put('/api/orders/:id/status', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const order = await storage.updateOrderStatus(id, status);
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  app.put('/api/orders/:id/shipping', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { address, method } = req.body;
      
      // Also update in ShipHero
      const order = await storage.getOrder(id);
      if (order?.shipHeroOrderId) {
        await shipHeroService.updateOrderShipping(order.shipHeroOrderId, address, method);
      }
      
      const updatedOrder = await storage.updateOrderShipping(id, address, method);
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order shipping" });
    }
  });

  // Product/Inventory routes
  app.get('/api/products', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === 'brand' && user.brandId) {
        // Brand users only see their own products
        const products = await storage.getProductsByBrand(user.brandId);
        res.json(products);
      } else if (user?.role === 'threePL' && user.threePlId) {
        // 3PL users see products from all their brands
        const products = await storage.getProductsByThreePL(user.threePlId);
        res.json(products);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post('/api/products', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  // Ticket routes
  app.get('/api/tickets', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === 'brand' && user.brandId) {
        // Brand users only see tickets related to their brand
        const tickets = await storage.getTicketsByBrand(user.brandId);
        res.json(tickets);
      } else if (user?.role === 'threePL' && user.threePlId) {
        // 3PL users see tickets from all their brands
        const tickets = await storage.getTicketsByThreePL(user.threePlId);
        res.json(tickets);
      } else {
        // Admin users see all tickets they're involved with
        const tickets = await storage.getTicketsByUser(userId);
        res.json(tickets);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.get('/api/tickets/:id', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const ticket = await storage.getTicket(id);
      const comments = await storage.getCommentsByTicket(id);
      const attachments = await storage.getAttachmentsByTicket(id);
      
      res.json({
        ticket,
        comments,
        attachments,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticket details" });
    }
  });

  app.post('/api/tickets', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      const ticketData = {
        ...insertTicketSchema.parse(req.body),
        createdById: userId,
        brandId: user?.brandId || null,
        threePlId: user?.threePlId || null,
      };
      
      const ticket = await storage.createTicket(ticketData);
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  app.put('/api/tickets/:id/status', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const ticket = await storage.updateTicketStatus(id, status);
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to update ticket status" });
    }
  });

  // Comment routes
  app.post('/api/tickets/:ticketId/comments', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { ticketId } = req.params;
      const userId = req.user?.claims?.sub;
      
      const commentData = {
        ...insertTicketCommentSchema.parse(req.body),
        ticketId,
        userId,
      };
      
      const comment = await storage.createComment(commentData);
      res.json(comment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // File upload routes
  app.post('/api/upload', isAuthenticated, upload.array('files'), async (req: AuthenticatedRequest, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const userId = req.user?.claims?.sub;
      const { ticketId, commentId } = req.body;
      
      const attachments = [];
      
      for (const file of files) {
        const attachment = await storage.createAttachment({
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path,
          ticketId: ticketId || null,
          commentId: commentId || null,
          uploadedById: userId,
        });
        attachments.push(attachment);
      }
      
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  // ShipHero integration routes
  app.post('/api/shiphero/sync-orders', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.brandId) {
        const brand = await storage.getBrand(user.brandId);
        if (brand?.shipHeroApiKey) {
          const orders = await shipHeroService.getOrders(brand.shipHeroApiKey);
          // Process and save orders
          res.json({ message: "Orders synced successfully", count: orders.length });
        } else {
          res.status(400).json({ message: "ShipHero API credentials not configured" });
        }
      } else {
        res.status(400).json({ message: "Brand not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to sync orders" });
    }
  });

  app.post('/api/shiphero/sync-inventory', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.brandId) {
        const brand = await storage.getBrand(user.brandId);
        if (brand?.shipHeroApiKey) {
          const products = await shipHeroService.getInventory(brand.shipHeroApiKey);
          // Process and update inventory
          res.json({ message: "Inventory synced successfully", count: products.length });
        } else {
          res.status(400).json({ message: "ShipHero API credentials not configured" });
        }
      } else {
        res.status(400).json({ message: "Brand not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to sync inventory" });
    }
  });

  // Dashboard stats route
  app.get('/api/dashboard/stats', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      let stats = {
        totalOrders: 0,
        openTickets: 0,
        urgentTickets: 0,
        pendingOrders: 0,
        recentActivity: []
      };
      
      if (user?.role === 'brand' && user.brandId) {
        // Brand-specific stats
        stats.totalOrders = await storage.getTotalOrdersCountByBrand(user.brandId);
        stats.openTickets = await storage.getOpenTicketsCountByBrand(user.brandId);
        stats.urgentTickets = await storage.getUrgentTicketsCountByBrand(user.brandId);
        stats.pendingOrders = await storage.getPendingOrdersCountByBrand(user.brandId);
      } else if (user?.role === 'threePL' && user.threePlId) {
        // 3PL consolidated stats across all brands
        stats.totalOrders = await storage.getTotalOrdersCountByThreePL(user.threePlId);
        stats.openTickets = await storage.getOpenTicketsCountByThreePL(user.threePlId);
        stats.urgentTickets = await storage.getUrgentTicketsCountByThreePL(user.threePlId);
        stats.pendingOrders = await storage.getPendingOrdersCountByThreePL(user.threePlId);
      } else {
        // Admin stats - overall system stats
        stats.totalOrders = await storage.getTotalOrdersCount();
        stats.openTickets = await storage.getOpenTicketsCount();
        stats.urgentTickets = await storage.getUrgentTicketsCount();
        stats.pendingOrders = await storage.getPendingOrdersCount();
      }
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
