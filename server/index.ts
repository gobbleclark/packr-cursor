import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler, notFound } from "./utils/errorHandler";
import { logger, requestLogger, requestTimer } from "./utils/logger";
import { applyRateLimiting } from "./utils/rateLimiter";
import { healthCheckMiddleware, initializeHealthChecker, setupGracefulShutdown } from "./utils/healthCheck";

const app = express();

// Initialize health checker if DATABASE_URL is available
if (process.env.DATABASE_URL) {
  try {
    initializeHealthChecker(process.env.DATABASE_URL);
    logger.info('Health checker initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize health checker', { error: error.message });
  }
}

// Security middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Add security headers
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  next();
});

// Request logging and timing
app.use(requestLogger);
app.use(requestTimer);

// Rate limiting
app.use(applyRateLimiting);

// Health check endpoint
app.use(healthCheckMiddleware);

// Legacy logging middleware (keeping for backward compatibility)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    const environment = app.get("env");
    logger.info(`Server environment: ${environment}`);
    
    if (environment === "development") {
      logger.info("Setting up Vite development server");
      await setupVite(app, server);
    } else {
      logger.info("Setting up static file serving for production");
      serveStatic(app);
    }

    // 404 handler - must be AFTER serveStatic so React app can handle routing
    app.use(notFound);

    // Global error handler - must be last
    app.use(errorHandler);

    // Setup graceful shutdown
    setupGracefulShutdown(server);

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      logger.info(`🚀 Server started successfully`, {
        port,
        environment: app.get("env"),
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage()
      });
      
      // Log startup message for backward compatibility
      log(`serving on port ${port}`);
    });

    // Log server startup
    logger.info('Packr 3PL Management Platform started', {
      port,
      environment: app.get("env"),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
})();
