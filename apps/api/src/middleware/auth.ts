import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/database';
import { logger } from '../utils/logger';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        threeplId?: string;
        brandId?: string;
        role: string;
        memberships: Array<{
          threeplId?: string;
          brandId?: string;
          role: string;
        }>;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: NonNullable<Request['user']>;
}

// JWT verification middleware
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid authentication token'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key') as any;
    
    if (!decoded.userId) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is malformed'
      });
    }

    // Get user data from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        memberships: {
          include: {
            threepl: true,
            brand: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'User account no longer exists'
      });
    }

    // Debug logging
    logger.info(`Auth middleware - User: ${user.email}, Memberships: ${JSON.stringify(user.memberships)}`);

    // Find the primary 3PL membership (for 3PL users) - 3PL only, no brand
    const primaryMembership = user.memberships.find(m => m.threeplId && !m.brandId);
    
    // Find the primary brand membership (for brand users) - has brand (may also have 3PL)
    const primaryBrandMembership = user.memberships.find(m => m.brandId);
    
    logger.info(`Auth middleware - Primary 3PL membership: ${JSON.stringify(primaryMembership)}`);
    logger.info(`Auth middleware - Primary brand membership: ${JSON.stringify(primaryBrandMembership)}`);
    
    // Determine primary role and IDs
    let primaryRole = 'USER';
    let primaryThreeplId: string | undefined;
    let primaryBrandId: string | undefined;
    
    if (primaryMembership) {
      // User has 3PL access
      primaryRole = primaryMembership.role;
      primaryThreeplId = primaryMembership.threeplId;
      logger.info(`Auth middleware - Using 3PL membership: Role=${primaryRole}, ThreePL=${primaryThreeplId}`);
    } else if (primaryBrandMembership) {
      // User is brand-only
      primaryRole = primaryBrandMembership.role;
      primaryBrandId = primaryBrandMembership.brandId;
      
      // Get the 3PL ID from the brand
      const brand = await prisma.brand.findUnique({
        where: { id: primaryBrandMembership.brandId },
        select: { threeplId: true }
      });
      primaryThreeplId = brand?.threeplId;
      logger.info(`Auth middleware - Using brand membership: Role=${primaryRole}, Brand=${primaryBrandId}, ThreePL=${primaryThreeplId}`);
    } else {
      logger.warn(`Auth middleware - No valid membership found for user ${user.email}`);
    }
    
    // Attach user data to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      threeplId: primaryThreeplId,
      brandId: primaryBrandId,
      role: primaryRole,
      memberships: user.memberships.map(m => ({
        threeplId: m.threeplId || undefined,
        brandId: m.brandId || undefined,
        role: m.role
      }))
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};

// Middleware to ensure user is authenticated and has a 3PL
export const requireThreePL = (req: Request, res: Response, next: NextFunction) => {
  const authenticatedReq = req as AuthenticatedRequest;
  if (!authenticatedReq.user.threeplId) {
    return res.status(403).json({
      error: '3PL access required',
      message: 'You must be associated with a 3PL to access this resource'
    });
  }
  next();
};

// Middleware to check if user has specific role
export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authenticatedReq = req as AuthenticatedRequest;
    const hasRole = authenticatedReq.user.memberships.some(membership => 
      membership.role === requiredRole
    );

    if (!hasRole) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Role '${requiredRole}' is required to access this resource`
      });
    }
    next();
  };
};

// Middleware to ensure user can only access their own 3PL's data
export const requireOwnThreePL = (req: Request, res: Response, next: NextFunction) => {
  const authenticatedReq = req as AuthenticatedRequest;
  const requestedThreePLId = req.params.threeplId || req.body.threeplId;
  
  if (requestedThreePLId && requestedThreePLId !== authenticatedReq.user.threeplId) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You can only access data from your own 3PL'
    });
  }
  next();
};

// Middleware to ensure user can only access their own brand's data
export const requireOwnBrand = async (req: Request, res: Response, next: NextFunction) => {
  const authenticatedReq = req as AuthenticatedRequest;
  const requestedBrandId = req.params.brandId || req.body.brandId;
  
  if (requestedBrandId) {
    // Check if user has access to this brand
    const hasAccess = authenticatedReq.user.memberships.some(membership => 
      membership.brandId === requestedBrandId || 
      (membership.threeplId === authenticatedReq.user.threeplId && membership.role === 'THREEPL_ADMIN')
    );

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access data from brands you have access to'
      });
    }
  }
  next();
};

// Combined middleware for 3PL operations
export const requireThreePLAccess = [
  authenticateToken,
  requireThreePL,
  requireOwnThreePL
];

// Combined middleware for brand operations
export const requireBrandAccess = [
  authenticateToken,
  requireThreePL,
  requireOwnThreePL,
  requireOwnBrand
];

// Middleware for admin operations
export const requireAdmin = [
  authenticateToken,
  requireThreePL,
  requireRole('THREEPL_ADMIN')
];
