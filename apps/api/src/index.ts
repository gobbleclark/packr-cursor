import { config } from 'dotenv';
import path from 'path';

// Load environment variables from the root directory FIRST
config({ path: path.resolve(__dirname, '../../../.env') });

// Now import everything else
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoPretty from 'pino-pretty';

// Import routes
import authRoutes from './routes/auth';
import brandRoutes from './routes/brands';
import trackstarRoutes from './routes/trackstar';
import dashboardRoutes from './routes/dashboard';
import messageRoutes from './routes/messages';
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import orderRoutes from './routes/orders';
import inventoryRoutes from './routes/inventory';
import inventoryWebhookRoutes from './routes/webhooks/inventory';
import notificationRoutes from './routes/notifications';

// Import services
import { periodicSyncService } from './services/periodicSync';

const logger = pino(
  pinoPretty({
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  })
);

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Rate limiting - disabled in development
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs in production
    message: { error: 'Too many requests from this IP, please try again later.' },
  });
  app.use('/api/', limiter);
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/webhooks', inventoryWebhookRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', trackstarRoutes);

// API root endpoint
app.get('/api', (req, res) => {
          res.json({
          message: 'Packr API',
          version: '0.1.0',
          status: 'running',
              endpoints: {
            auth: '/api/auth',
            brands: '/api/brands',
            messages: '/api/messages',
            users: '/api/users',
            settings: '/api/settings',
            orders: '/api/orders',
            inventory: '/api/inventory',
            dashboard: '/api/dashboard',
            trackstar: '/api/brands/:brandId/integrations/trackstar',
            webhooks: '/api/webhooks/trackstar',
            inventoryWebhooks: '/api/webhooks/trackstar/inventory',
            health: '/health',
          },
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`,
  });
});

app.listen(PORT, () => {
          logger.info(`🚀 Packr API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`API docs: http://localhost:${PORT}/api`);
  
  // Start periodic sync service
  if (process.env.NODE_ENV !== 'test') {
    periodicSyncService.start();
    logger.info('🔄 Periodic sync service started');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  periodicSyncService.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  periodicSyncService.stop();
  process.exit(0);
});

export default app;
