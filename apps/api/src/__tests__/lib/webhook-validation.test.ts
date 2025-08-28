import crypto from 'crypto';
import { Request } from 'express';
import { WebhookValidator, createTrackstarWebhookValidator } from '../../lib/webhook-validation';

describe('WebhookValidator', () => {
  const testSecret = 'test-webhook-secret-key';
  const testPayload = { event_id: '123', sku: 'TEST-SKU' };
  const testPayloadBuffer = Buffer.from(JSON.stringify(testPayload));

  describe('signature validation', () => {
    const validator = new WebhookValidator({
      secret: testSecret,
      headerName: 'x-test-signature',
      algorithm: 'sha256',
      skipValidation: false
    });

    const validSignature = crypto
      .createHmac('sha256', testSecret)
      .update(testPayloadBuffer)
      .digest('hex');

    it('should validate correct signature', () => {
      const mockReq = {
        headers: { 'x-test-signature': `sha256=${validSignature}` }
      } as Request;

      const result = validator.validateSignature(mockReq, testPayloadBuffer);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate signature without sha256 prefix', () => {
      const mockReq = {
        headers: { 'x-test-signature': validSignature }
      } as Request;

      const result = validator.validateSignature(mockReq, testPayloadBuffer);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid signature', () => {
      const mockReq = {
        headers: { 'x-test-signature': 'invalid-signature-123' }
      } as Request;

      const result = validator.validateSignature(mockReq, testPayloadBuffer);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('verification failed');
    });

    it('should reject missing signature header', () => {
      const mockReq = { headers: {} } as Request;

      const result = validator.validateSignature(mockReq, testPayloadBuffer);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing signature header');
    });

    it('should skip validation when disabled', () => {
      const skipValidator = new WebhookValidator({
        secret: testSecret,
        headerName: 'x-test-signature',
        algorithm: 'sha256',
        skipValidation: true
      });

      const mockReq = { headers: {} } as Request;

      const result = skipValidator.validateSignature(mockReq, testPayloadBuffer);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle missing secret gracefully', () => {
      const noSecretValidator = new WebhookValidator({
        headerName: 'x-test-signature',
        algorithm: 'sha256',
        skipValidation: false
      });

      const mockReq = {
        headers: { 'x-test-signature': validSignature }
      } as Request;

      const result = noSecretValidator.validateSignature(mockReq, testPayloadBuffer);
      expect(result.valid).toBe(true); // Should skip validation
    });
  });

  describe('correlation ID extraction', () => {
    const validator = new WebhookValidator({
      headerName: 'x-test-signature',
      algorithm: 'sha256'
    });

    it('should extract correlation ID from headers', () => {
      const testCorrelationId = 'test-correlation-123';
      const mockReq = {
        headers: { 'x-correlation-id': testCorrelationId },
        body: {}
      } as Request;

      const result = validator.extractCorrelationId(mockReq);
      expect(result).toBe(testCorrelationId);
    });

    it('should extract from x-request-id header', () => {
      const testRequestId = 'test-request-456';
      const mockReq = {
        headers: { 'x-request-id': testRequestId },
        body: {}
      } as Request;

      const result = validator.extractCorrelationId(mockReq);
      expect(result).toBe(testRequestId);
    });

    it('should extract from payload delivery_id', () => {
      const testDeliveryId = 'delivery-789';
      const mockReq = {
        headers: {},
        body: { delivery_id: testDeliveryId }
      } as Request;

      const result = validator.extractCorrelationId(mockReq);
      expect(result).toBe(testDeliveryId);
    });

    it('should return undefined if no correlation ID found', () => {
      const mockReq = {
        headers: {},
        body: {}
      } as Request;

      const result = validator.extractCorrelationId(mockReq);
      expect(result).toBeUndefined();
    });
  });

  describe('idempotency key generation', () => {
    const validator = new WebhookValidator({
      headerName: 'x-test-signature',
      algorithm: 'sha256'
    });

    it('should generate consistent idempotency keys for same payload', () => {
      const params = {
        tenantId: 'tenant-123',
        brandId: 'brand-456',
        resource: 'inventory',
        action: 'updated',
        payload: { sku: 'TEST-SKU', quantity: 100 }
      };

      const key1 = validator.generateIdempotencyKey(params);
      const key2 = validator.generateIdempotencyKey(params);

      expect(key1).toBe(key2);
      expect(key1).toContain('tenant-123:brand-456:inventory:updated:');
      expect(key1.length).toBeGreaterThan(50); // Should include hash
    });

    it('should generate different keys for different payloads', () => {
      const params1 = {
        tenantId: 'tenant-123',
        brandId: 'brand-456',
        resource: 'inventory',
        action: 'updated',
        payload: { sku: 'TEST-SKU-1', quantity: 100 }
      };

      const params2 = {
        tenantId: 'tenant-123',
        brandId: 'brand-456',
        resource: 'inventory',
        action: 'updated',
        payload: { sku: 'TEST-SKU-2', quantity: 100 }
      };

      const key1 = validator.generateIdempotencyKey(params1);
      const key2 = validator.generateIdempotencyKey(params2);

      expect(key1).not.toBe(key2);
    });

    it('should handle string payloads', () => {
      const params = {
        tenantId: 'tenant-123',
        brandId: 'brand-456',
        resource: 'inventory',
        action: 'updated',
        payload: 'string-payload'
      };

      const key = validator.generateIdempotencyKey(params);
      expect(key).toContain('tenant-123:brand-456:inventory:updated:');
    });

    it('should normalize object key order for consistent hashing', () => {
      const params1 = {
        tenantId: 'tenant-123',
        brandId: 'brand-456', 
        resource: 'inventory',
        action: 'updated',
        payload: { sku: 'TEST-SKU', quantity: 100, warehouse: 'WH1' }
      };

      const params2 = {
        tenantId: 'tenant-123',
        brandId: 'brand-456',
        resource: 'inventory', 
        action: 'updated',
        payload: { warehouse: 'WH1', sku: 'TEST-SKU', quantity: 100 } // Different order
      };

      const key1 = validator.generateIdempotencyKey(params1);
      const key2 = validator.generateIdempotencyKey(params2);

      expect(key1).toBe(key2);
    });
  });

  describe('createTrackstarWebhookValidator factory', () => {
    it('should create validator with correct configuration', () => {
      const originalEnv = process.env.TRACKSTAR_WEBHOOK_SECRET;
      process.env.TRACKSTAR_WEBHOOK_SECRET = 'test-secret';

      const validator = createTrackstarWebhookValidator();
      expect(validator).toBeInstanceOf(WebhookValidator);

      // Restore environment
      if (originalEnv !== undefined) {
        process.env.TRACKSTAR_WEBHOOK_SECRET = originalEnv;
      } else {
        delete process.env.TRACKSTAR_WEBHOOK_SECRET;
      }
    });

    it('should skip validation in development mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const validator = createTrackstarWebhookValidator();
      const mockReq = { headers: {} } as Request;
      const result = validator.validateSignature(mockReq, Buffer.from('test'));

      expect(result.valid).toBe(true);

      // Restore environment
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });
  });
});