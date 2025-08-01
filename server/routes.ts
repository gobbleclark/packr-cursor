import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
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
import { BackgroundJobService } from "./services/backgroundJobs";

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
      
      const stats = await storage.getDashboardStats(userId, user.role || 'brand');
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
      
      if (user?.brandId) {
        const products = await storage.getProductsByBrand(user.brandId);
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
      const { status, priority } = req.query;
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      const filters: any = {};
      if (status) filters.status = status as string;
      if (priority) filters.priority = priority as string;
      if (user?.brandId) filters.brandId = user.brandId;
      
      const tickets = await storage.getTicketsWithComments(filters);
      res.json(tickets);
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

  const httpServer = createServer(app);
  return httpServer;
}
