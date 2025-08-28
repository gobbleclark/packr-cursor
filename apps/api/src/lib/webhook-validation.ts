import crypto from 'crypto';
import { Request } from 'express';
import { logger } from '../utils/logger';

export interface WebhookValidationConfig {
  secret?: string;
  headerName: string;
  algorithm: string;
  skipValidation?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  correlationId?: string;
}

/**
 * Webhook signature validation utility
 * Supports HMAC-based signature validation with configurable algorithms
 */
export class WebhookValidator {
  private config: WebhookValidationConfig;

  constructor(config: WebhookValidationConfig) {
    this.config = config;
  }

  /**
   * Validate webhook signature against request payload
   */
  validateSignature(req: Request, rawBody: Buffer): ValidationResult {
    try {
      // Skip validation if explicitly disabled (dev/testing)
      if (this.config.skipValidation) {
        logger.debug('Webhook signature validation skipped (disabled)');
        return { valid: true };
      }

      if (!this.config.secret) {
        logger.warn('Webhook secret not configured, validation skipped');
        return { valid: true };
      }

      const signature = req.headers[this.config.headerName] as string;
      if (!signature) {
        return {
          valid: false,
          error: `Missing signature header: ${this.config.headerName}`
        };
      }

      // Parse signature format: "sha256=<hex_signature>" or just "<hex_signature>"
      const signatureMatch = signature.match(/^(?:sha256=)?([a-f0-9]+)$/i);
      if (!signatureMatch) {
        return {
          valid: false,
          error: 'Invalid signature format'
        };
      }

      const providedSignature = signatureMatch[1].toLowerCase();

      // Compute expected signature
      const expectedSignature = crypto
        .createHmac(this.config.algorithm, this.config.secret)
        .update(rawBody)
        .digest('hex')
        .toLowerCase();

      // Constant-time comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        return {
          valid: false,
          error: 'Signature verification failed'
        };
      }

      return { valid: true };

    } catch (error) {
      logger.error('Error validating webhook signature:', error);
      return {
        valid: false,
        error: 'Signature validation error'
      };
    }
  }

  /**
   * Extract correlation ID from request headers or payload
   */
  extractCorrelationId(req: Request): string | undefined {
    // Try common correlation ID headers
    const correlationHeaders = [
      'x-correlation-id',
      'x-request-id',
      'x-trackstar-request-id',
      'x-delivery-id'
    ];

    for (const header of correlationHeaders) {
      const value = req.headers[header] as string;
      if (value) {
        return value;
      }
    }

    // Try to extract from payload if available
    try {
      const body = req.body;
      if (body?.delivery_id) return body.delivery_id;
      if (body?.request_id) return body.request_id;
      if (body?.correlation_id) return body.correlation_id;
    } catch (error) {
      // Ignore payload parsing errors
    }

    return undefined;
  }

  /**
   * Generate content-based idempotency key
   * Format: {tenant}:{brand}:{resource}:{action}:{hash(payload)}
   */
  generateIdempotencyKey(params: {
    tenantId: string;
    brandId: string;
    resource: string;
    action: string;
    payload: any;
  }): string {
    const { tenantId, brandId, resource, action, payload } = params;

    // Create deterministic payload hash
    const payloadStr = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload, Object.keys(payload).sort());
    
    const payloadHash = crypto
      .createHash('sha256')
      .update(payloadStr)
      .digest('hex')
      .substring(0, 16); // First 16 chars for brevity

    return `${tenantId}:${brandId}:${resource}:${action}:${payloadHash}`;
  }
}

/**
 * Factory for creating Trackstar webhook validator
 */
export const createTrackstarWebhookValidator = (): WebhookValidator => {
  return new WebhookValidator({
    secret: process.env.TRACKSTAR_WEBHOOK_SECRET,
    headerName: 'x-trackstar-signature',
    algorithm: 'sha256',
    skipValidation: process.env.NODE_ENV === 'development' || 
                   process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION === 'true'
  });
};

/**
 * Express middleware for webhook validation
 */
export const webhookValidationMiddleware = (validator: WebhookValidator) => {
  return (req: Request, res: any, next: any) => {
    // Ensure we have raw body for signature validation
    if (!req.rawBody) {
      logger.warn('Raw body not available for webhook signature validation');
      return res.status(400).json({ error: 'Raw body required for signature validation' });
    }

    const validation = validator.validateSignature(req, req.rawBody);
    
    if (!validation.valid) {
      logger.warn('Webhook signature validation failed:', validation.error);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Extract and attach correlation ID
    req.correlationId = validator.extractCorrelationId(req);

    next();
  };
};