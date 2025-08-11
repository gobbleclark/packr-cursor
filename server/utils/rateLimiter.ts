import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: 15 * 60 * 1000, // 15 minutes default
      maxRequests: 100, // 100 requests per window default
      message: 'Too many requests, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  private getKey(req: Request): string {
    // Use user ID if authenticated, otherwise IP address
    const userId = (req as any).user?.claims?.sub;
    return userId || req.ip || 'anonymous';
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime <= now) {
        delete this.store[key];
      }
    });
  }

  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const entry = this.store[key];

    if (!entry || entry.resetTime <= now) {
      // Reset or create new entry
      this.store[key] = {
        count: 1,
        resetTime: now + this.config.windowMs
      };
      return false;
    }

    if (entry.count >= this.config.maxRequests) {
      return true;
    }

    entry.count++;
    return false;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      
      if (this.isRateLimited(key)) {
        const entry = this.store[key];
        const retryAfter = Math.ceil((entry.resetTime - Date.now()) / 1000);
        
        logger.warn('Rate limit exceeded', {
          key,
          count: entry.count,
          maxRequests: this.config.maxRequests,
          resetTime: new Date(entry.resetTime).toISOString(),
          url: req.url,
          method: req.method,
          userId: (req as any).user?.claims?.sub
        });

        res.set({
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
        });

        return res.status(429).json({
          success: false,
          error: {
            message: this.config.message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter,
            resetTime: new Date(entry.resetTime).toISOString()
          }
        });
      }

      // Add rate limit headers to response
      const entry = this.store[key];
      if (entry) {
        res.set({
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, this.config.maxRequests - entry.count).toString(),
          'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
        });
      }

      next();
    };
  }
}

// Create different rate limiters for different endpoints
export const createRateLimiter = (config: RateLimitConfig) => {
  return new RateLimiter(config);
};

// Default rate limiters
export const defaultRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100 // 100 requests per 15 minutes
});

export const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30 // 30 requests per 15 minutes
});

export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10 // 10 webhooks per minute
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5 // 5 auth attempts per 15 minutes
});

// Apply rate limiting based on endpoint type
export const applyRateLimiting = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  
  // Apply stricter limits to sensitive endpoints
  if (path.startsWith('/api/auth')) {
    return authRateLimiter.middleware()(req, res, next);
  }
  
  if (path.startsWith('/api/webhooks')) {
    return webhookRateLimiter.middleware()(req, res, next);
  }
  
  // Apply default rate limiting to all other endpoints
  return defaultRateLimiter.middleware()(req, res, next);
};
