import type { Express, Request } from "express";
import express from "express";
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
import trackstarConnectionRoutes from "./routes/trackstarConnection";
import { TrackstarService } from "./services/trackstar";
import { TrackstarSyncService } from "./services/trackstarSync";
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
  const trackstarService = new TrackstarService();
  const trackstarSyncService = new TrackstarSyncService();
  
  // Start Trackstar sync service
  trackstarSyncService.startPeriodicSync();
  
  // Mount Trackstar connection routes
  app.use('/api/trackstar', trackstarConnectionRoutes);
  
  // Trackstar integrations info
  const trackstarIntegrationsRoutes = await import('./routes/trackstarIntegrations.js');
  app.use('/api/trackstar-info', trackstarIntegrationsRoutes.default);

  // Trackstar logs and monitoring
  const trackstarLogsRoutes = await import('./routes/trackstarLogs.js');
  app.use('/api/trackstar', trackstarLogsRoutes.default);

  // Trackstar webhooks
  const trackstarWebhooksRoutes = await import('./routes/trackstarWebhooks.js');
  app.use('/api/trackstar', trackstarWebhooksRoutes.default);

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

  // Dashboard stats with date range support
  app.get('/api/dashboard/stats', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { startDate, endDate, brandId } = req.query;
      
      // Parse date range if provided
      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      // Use the comprehensive dashboard stats method
      const stats = await storage.getDashboardStatsWithDateRange(userId, dateRange, brandId as string);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Admin stats route
  app.get('/api/admin/stats', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const stats = {
        totalUsers: await storage.getTotalOrdersCount(), // Using orders count as users proxy
        totalBrands: await storage.getBrandsCount(),
        totalOrders: await storage.getTotalOrdersCount(),
        recent3PLs: await storage.getRecent3PLs(),
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
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
  app.get('/api/brands', async (req: any, res) => {
    try {
      // Temporarily bypass auth - return brands for Packr Logistics 3PL
      const brands = await storage.getBrandsByThreePL('d4d15ba7-a23e-4fbb-94be-c4f19c697f85');
      res.json(brands);
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

  // Legacy integration endpoint - now redirects to Trackstar
  app.put('/api/brands/:id/integrations', async (req: any, res) => {
    try {
      const { id: brandId } = req.params;
      console.log(`Legacy integration endpoint hit for brand ${brandId} - redirecting to Trackstar`);
      
      res.json({ 
        message: "Please use the new Trackstar integration system for connecting warehouse management systems", 
        success: false,
        redirect: "/brand-management"
      });
    } catch (error) {
      console.error("Error in legacy integration endpoint:", error);
      res.status(500).json({ message: "Failed to process integration request" });
    }
  });

  // Delete brand integration - now removes Trackstar connection
  app.delete('/api/brands/:id/integrations', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'threePL' && user?.role !== 'admin') {
        return res.status(403).json({ message: "Only 3PL managers can delete brand integrations" });
      }

      const { id: brandId } = req.params;
      
      // Remove Trackstar credentials from brand record
      await storage.updateBrandTrackstarCredentials(brandId, null);
      
      res.json({ message: "Trackstar integration disconnected successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to disconnect Trackstar integration" });
    }
  });

  // Brand invitation routes
  app.post('/api/brands/invite', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'threePL' && user?.role !== 'admin') {
        return res.status(403).json({ message: "Only 3PL managers can create brand invitations" });
      }

      const { name, email } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: "Brand name and email are required" });
      }

      // Get the 3PL company info for the invitation
      const threePL = user.threePlId ? await storage.getThreePL(user.threePlId) : null;

      // Generate invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');
      
      // Create brand with invitation
      const brand = await storage.createBrand({
        name,
        email,
        threePlId: user.threePlId || 'd4d15ba7-a23e-4fbb-94be-c4f19c697f85',
        isActive: false,
        invitationToken,
      });

      // Generate invitation link
      const invitationLink = `${req.protocol}://${req.hostname}/brand-invite/${invitationToken}`;

      // Send invitation email
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

  // Product routes
  app.get('/api/products', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === 'brand' && user.brandId) {
        const products = await storage.getProductsByBrand(user.brandId);
        res.json(products);
      } else if (user?.role === 'threePL' && user.threePlId) {
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
        const tickets = await storage.getTicketsByBrand(user.brandId);
        res.json(tickets);
      } else if (user?.role === 'threePL' && user.threePlId) {
        const tickets = await storage.getTicketsByThreePL(user.threePlId);
        res.json(tickets);
      } else {
        const tickets = await storage.getTicketsByUser(userId);
        res.json(tickets);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.post('/api/tickets', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      const ticketData = {
        ...insertTicketSchema.parse(req.body),
        createdById: userId,
        assignedToId: null,
      };
      
      const ticket = await storage.createTicket(ticketData);
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  // File upload for attachments
  app.post('/api/upload', isAuthenticated, upload.array('files'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const files = req.files as Express.Multer.File[];
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

  const server = createServer(app);
  return server;
}