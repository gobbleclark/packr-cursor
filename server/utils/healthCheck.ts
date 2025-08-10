import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { logger } from './logger';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime: number;
      error?: string;
    };
    memory: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      used: number;
      total: number;
      percentage: number;
    };
    uptime: {
      status: 'healthy';
      value: number;
    };
  };
  version: string;
  environment: string;
}

class HealthChecker {
  private pool: Pool;
  private startTime: number;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.startTime = Date.now();
  }

  private async checkDatabase(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; responseTime: number; error?: string }> {
    const start = Date.now();
    
    try {
      const db = drizzle({ client: this.pool });
      
      // Simple query to test database connectivity
      await db.execute('SELECT 1 as health_check');
      
      const responseTime = Date.now() - start;
      
      if (responseTime < 100) {
        return { status: 'healthy', responseTime };
      } else if (responseTime < 500) {
        return { status: 'degraded', responseTime };
      } else {
        return { status: 'unhealthy', responseTime };
      }
    } catch (error: any) {
      const responseTime = Date.now() - start;
      logger.error('Database health check failed', { error: error.message, responseTime });
      
      return { 
        status: 'unhealthy', 
        responseTime, 
        error: error.message 
      };
    }
  }

  private checkMemory(): { status: 'healthy' | 'degraded' | 'unhealthy'; used: number; total: number; percentage: number } {
    const memUsage = process.memoryUsage();
    const used = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
    const total = Math.round(memUsage.heapTotal / 1024 / 1024); // MB
    const percentage = Math.round((used / total) * 100);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (percentage > 90) {
      status = 'unhealthy';
    } else if (percentage > 75) {
      status = 'degraded';
    }

    return { status, used, total, percentage };
  }

  private checkUptime(): { status: 'healthy'; value: number } {
    const uptime = Date.now() - this.startTime;
    return { status: 'healthy', value: uptime };
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const [dbCheck, memoryCheck, uptimeCheck] = await Promise.all([
      this.checkDatabase(),
      Promise.resolve(this.checkMemory()),
      Promise.resolve(this.checkUptime())
    ]);

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (dbCheck.status === 'unhealthy' || memoryCheck.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (dbCheck.status === 'degraded' || memoryCheck.status === 'degraded') {
      overallStatus = 'degraded';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        memory: memoryCheck,
        uptime: uptimeCheck
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    // Log health status
    if (overallStatus === 'unhealthy') {
      logger.error('System health check failed', healthStatus);
    } else if (overallStatus === 'degraded') {
      logger.warn('System health check shows degraded performance', healthStatus);
    } else {
      logger.info('System health check passed', healthStatus);
    }

    return healthStatus;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Create health checker instance
let healthChecker: HealthChecker | null = null;

export const initializeHealthChecker = (connectionString: string): void => {
  if (healthChecker) {
    healthChecker.close();
  }
  healthChecker = new HealthChecker(connectionString);
};

export const getHealthStatus = async (): Promise<HealthStatus> => {
  if (!healthChecker) {
    throw new Error('Health checker not initialized');
  }
  return healthChecker.getHealthStatus();
};

export const closeHealthChecker = async (): Promise<void> => {
  if (healthChecker) {
    await healthChecker.close();
    healthChecker = null;
  }
};

// Health check endpoint middleware
export const healthCheckMiddleware = (req: any, res: any, next: any) => {
  if (req.path === '/health' || req.path === '/api/health') {
    getHealthStatus()
      .then(status => {
        res.status(status.status === 'unhealthy' ? 503 : 200).json(status);
      })
      .catch(error => {
        logger.error('Health check endpoint error', { error: error.message });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed',
          message: error.message
        });
      });
  } else {
    next();
  }
};

// Graceful shutdown handler
export const setupGracefulShutdown = (server: any): void => {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      // Close health checker
      await closeHealthChecker();
      
      // Close server
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};
