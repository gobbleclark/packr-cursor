import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      correlationId?: string;
    }
  }
}

/**
 * Express middleware to capture raw request body for webhook signature validation
 * Should be applied before any body parsing middleware
 */
export const captureRawBody = (req: Request, res: Response, next: NextFunction): void => {
  const chunks: Buffer[] = [];

  // Store original end function
  const originalEnd = res.end.bind(res);

  // Only capture raw body for webhook endpoints
  if (!req.path.includes('/webhooks/')) {
    return next();
  }

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (chunks.length > 0) {
      req.rawBody = Buffer.concat(chunks);
      logger.debug('Captured raw body for webhook validation', {
        path: req.path,
        contentLength: req.rawBody.length,
        contentType: req.headers['content-type']
      });
    }
  });

  // Override res.end to ensure we don't interfere with response
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    originalEnd(chunk, encoding, cb);
  };

  next();
};