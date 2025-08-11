import { z } from 'zod';
import { createError } from './errorHandler';

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format')
});

export const brandIdParamSchema = z.object({
  brandId: z.string().uuid('Invalid brand ID format')
});

// Brand validation schemas
export const createBrandSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(100, 'Brand name too long'),
  email: z.string().email('Invalid email format'),
  threePlId: z.string().uuid('Invalid 3PL ID format'),
  isActive: z.boolean().default(true),
  wmsProvider: z.string().optional(),
  integrationStatus: z.enum(['disconnected', 'connecting', 'connected', 'error']).default('disconnected')
});

export const updateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  wmsProvider: z.string().optional(),
  integrationStatus: z.enum(['disconnected', 'connecting', 'connected', 'error']).optional()
});

// Order validation schemas
export const createOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
  brandId: z.string().uuid('Invalid brand ID format'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Invalid customer email format'),
  shippingAddress: z.object({
    address1: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'ZIP code is required'),
    country: z.string().min(1, 'Country is required')
  }),
  status: z.enum(['pending', 'allocated', 'packed', 'shipped', 'delivered', 'cancelled']).default('pending'),
  totalAmount: z.string().regex(/^\d+\.\d{2}$/, 'Invalid amount format'),
  orderItems: z.array(z.object({
    sku: z.string().min(1, 'SKU is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    productName: z.string().min(1, 'Product name is required'),
    price: z.string().regex(/^\d+\.\d{2}$/, 'Invalid price format')
  })).min(1, 'At least one order item is required')
});

export const updateOrderSchema = z.object({
  status: z.enum(['pending', 'allocated', 'packed', 'shipped', 'delivered', 'cancelled']).optional(),
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  shippingAddress: z.object({
    address1: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    zipCode: z.string().min(1).optional(),
    country: z.string().min(1).optional()
  }).optional(),
  totalAmount: z.string().regex(/^\d+\.\d{2}$/).optional()
});

// Product validation schemas
export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Product name is required'),
  brandId: z.string().uuid('Invalid brand ID format'),
  description: z.string().optional(),
  price: z.string().regex(/^\d+\.\d{2}$/, 'Invalid price format'),
  cost: z.string().regex(/^\d+\.\d{2}$/, 'Invalid cost format').optional(),
  weight: z.number().min(0, 'Weight must be non-negative').optional(),
  dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional()
  }).optional(),
  isActive: z.boolean().default(true)
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.string().regex(/^\d+\.\d{2}$/).optional(),
  cost: z.string().regex(/^\d+\.\d{2}$/).optional(),
  weight: z.number().min(0).optional(),
  dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional()
  }).optional(),
  isActive: z.boolean().optional()
});

// Ticket validation schemas
export const createTicketSchema = z.object({
  title: z.string().min(1, 'Ticket title is required').max(200, 'Title too long'),
  description: z.string().min(1, 'Ticket description is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.enum(['technical', 'billing', 'support', 'feature', 'bug']).default('support'),
  brandId: z.string().uuid('Invalid brand ID format').optional(),
  threePlId: z.string().uuid('Invalid 3PL ID format').optional()
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z.enum(['technical', 'billing', 'support', 'feature', 'bug']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional()
});

// Comment validation schemas
export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
  ticketId: z.string().uuid('Invalid ticket ID format'),
  isInternal: z.boolean().default(false)
});

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['admin', 'threePL', 'brand']),
  brandId: z.string().uuid('Invalid brand ID format').optional(),
  threePlId: z.string().uuid('Invalid 3PL ID format').optional()
});

// Sync validation schemas
export const syncRequestSchema = z.object({
  brandId: z.string().uuid('Invalid brand ID format'),
  syncType: z.enum(['orders', 'products', 'inventory', 'shipments', 'all']),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  forceFullSync: z.boolean().default(false)
});

// Webhook validation schemas
export const webhookEventSchema = z.object({
  event: z.string().min(1, 'Event type is required'),
  data: z.any(),
  timestamp: z.string().datetime().optional(),
  signature: z.string().optional()
});

// Validation middleware factory
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validatedData = schema.parse({
        ...req.params,
        ...req.query,
        ...req.body
      });
      
      // Replace the request data with validated data
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = createError(
          'Validation failed',
          400,
          'VALIDATION_ERROR'
        );
        validationError.details = error.errors;
        return next(validationError);
      }
      next(error);
    }
  };
};

// Sanitize input data
export const sanitizeInput = (data: any): any => {
  if (typeof data === 'string') {
    return data.trim().replace(/[<>]/g, '');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
};

// Validate and sanitize middleware
export const validateAndSanitize = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validatedData = schema.parse({
        ...req.params,
        ...req.query,
        ...req.body
      });
      
      // Sanitize the validated data
      const sanitizedData = sanitizeInput(validatedData);
      
      // Replace the request data with sanitized data
      req.validatedData = sanitizedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = createError(
          'Validation failed',
          400,
          'VALIDATION_ERROR'
        );
        validationError.details = error.errors;
        return next(validationError);
      }
      next(error);
    }
  };
};
