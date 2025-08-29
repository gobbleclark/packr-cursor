import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/database';
import { emailService } from '../services/emailService';
import { logger } from '../utils/logger';
import { authenticateToken, requireThreePL, requireRole, requireOwnThreePL, requireOwnBrand, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// Test email endpoint for development
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Please provide an email address to test'
      });
    }

    const result = await emailService.sendTestEmail(email);
    
    if (result) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        note: 'Check your email inbox and the server logs for details'
      });
    } else {
      res.status(500).json({
        error: 'Failed to send test email',
        message: 'Check server logs for details'
      });
    }
  } catch (error) {
    logger.error('Test email endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send test email'
    });
  }
});

// Validation schemas
const createBrandSchema = z.object({
  brandName: z.string().min(1, 'Brand name is required'),
  brandSlug: z.string().min(1, 'Brand slug is required').regex(/^[a-z0-9-]+$/, 'Brand slug must contain only lowercase letters, numbers, and hyphens'),
  integrationType: z.string().optional(),
  integrationConfig: z.string().optional(),
  invitedUsers: z.array(z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['BRAND_USER', 'BRAND_ADMIN'])
  })).optional().default([])
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

// Create brand with invitations (requires 3PL admin)
router.post('/', authenticateToken, requireThreePL, requireRole('THREEPL_ADMIN'), async (req, res) => {
      try {
      const data = createBrandSchema.parse(req.body);
      
      // Get the 3PL ID from the authenticated user
      const authenticatedReq = req as AuthenticatedRequest;
      const threeplId = authenticatedReq.user.threeplId;
    
    if (!threeplId) {
      return res.status(403).json({
        error: '3PL access required',
        message: 'You must be associated with a 3PL to create brands'
      });
    }
    
    // Check if brand slug already exists for this 3PL
    const existingBrand = await prisma.brand.findFirst({
      where: {
        threeplId,
        slug: data.brandSlug
      }
    });

    if (existingBrand) {
      return res.status(409).json({
        error: 'Brand slug already exists',
        message: 'A brand with this URL slug already exists in your 3PL'
      });
    }

    // Create brand and invitations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the brand
      const brand = await tx.brand.create({
        data: {
          name: data.brandName,
          slug: data.brandSlug,
          threeplId,
          settings: {
            integrationType: data.integrationType || null,
            integrationConfig: data.integrationConfig || null
          }
        }
      });

      // Auto-create chat room for the new brand
      await tx.chatRoom.create({
        data: {
          threeplId,
          brandId: brand.id
        }
      });

      logger.info(`Auto-created chat room for brand ${brand.name} (${brand.id})`);

      // Create invitations for each user (if any)
      const invitations = [];
      if (data.invitedUsers && data.invitedUsers.length > 0) {
        const invitationPromises = data.invitedUsers.map(async (userData) => {
          const token = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

          const invitation = await tx.brandInvitation.create({
            data: {
              email: userData.email,
              brandId: brand.id,
              threeplId,
              role: userData.role,
              token,
              expiresAt
            }
          });

          return invitation;
        });
        
        invitations.push(...(await Promise.all(invitationPromises)));
      }

      return { brand, invitations };
    });

    // Send invitation emails (if any)
    if (result.invitations.length > 0) {
      const emailPromises = result.invitations.map(async (invitation) => {
        try {
          const invitationUrl = `${process.env.FRONTEND_URL || 'https://packr.co'}/accept-invitation?token=${invitation.token}`;
          
          await emailService.sendBrandInvitation(invitation.email, {
            brandName: result.brand.name,
            threeplName: 'Your 3PL', // You'll need to get this from the authenticated user
            invitationUrl,
            expiresAt: invitation.expiresAt,
            role: invitation.role
          });

          logger.info(`Invitation email sent to ${invitation.email}`);
        } catch (error) {
          logger.error(`Failed to send invitation email to ${invitation.email}:`, error);
        }
      });

      // Wait for all emails to be sent (but don't fail the request if emails fail)
      await Promise.allSettled(emailPromises);
    }

    res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      brand: {
        id: result.brand.id,
        name: result.brand.name,
        slug: result.brand.slug,
        createdAt: result.brand.createdAt
      },
      invitations: result.invitations.map(inv => ({
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt
      }))
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    logger.error('Failed to create brand:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create brand'
    });
  }
});

// Accept invitation
router.post('/accept-invitation', async (req, res) => {
  try {
    const data = acceptInvitationSchema.parse(req.body);
    
    // Find the invitation by token
    const invitation = await prisma.brandInvitation.findUnique({
      where: { token: data.token },
      include: { brand: true, threepl: true }
    });

    if (!invitation) {
      return res.status(404).json({
        error: 'Invalid invitation',
        message: 'Invitation not found or already used'
      });
    }

    if (invitation.accepted) {
      return res.status(400).json({
        error: 'Invitation already accepted',
        message: 'This invitation has already been used'
      });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'Invitation expired',
        message: 'This invitation has expired'
      });
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: invitation.email }
    });

    if (!user) {
      // Create new user with password
      user = await prisma.user.create({
        data: {
          clerkId: `clerk_${Date.now()}`,
          email: invitation.email,
          firstName: data.firstName,
          lastName: data.lastName,
          password: data.password // Store the password (should be hashed in production)
        }
      });
    } else {
      // Update existing user's name if it changed
      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName
        }
      });
    }

    // Create membership
    await prisma.membership.create({
      data: {
        userId: user.id,
        brandId: invitation.brandId,
        role: invitation.role
      }
    });

    // Mark invitation as accepted
    await prisma.brandInvitation.update({
      where: { id: invitation.id },
      data: { accepted: true }
    });

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      brand: {
        id: invitation.brand.id,
        name: invitation.brand.name
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    logger.error('Failed to accept invitation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to accept invitation'
    });
  }
});

// Verify invitation token
router.get('/verify-invitation', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Token is required'
      });
    }

    const invitation = await prisma.brandInvitation.findUnique({
      where: { token },
      include: { 
        brand: true, 
        threepl: true 
      }
    });

    if (!invitation) {
      return res.status(404).json({
        error: 'Invitation not found',
        message: 'This invitation is invalid or has expired'
      });
    }

    if (invitation.accepted) {
      return res.status(400).json({
        error: 'Invitation already accepted',
        message: 'This invitation has already been used'
      });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'Invitation expired',
        message: 'This invitation has expired'
      });
    }

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        brand: {
          id: invitation.brand.id,
          name: invitation.brand.name
        },
        threepl: {
          id: invitation.threepl.id,
          name: invitation.threepl.name
        }
      }
    });

  } catch (error) {
    logger.error('Failed to verify invitation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify invitation'
    });
  }
});

// Get all brands for the authenticated 3PL
router.get('/', authenticateToken, requireThreePL, async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const threeplId = authenticatedReq.user.threeplId;
    
    if (!threeplId) {
      return res.status(403).json({
        error: '3PL access required',
        message: 'You must be associated with a 3PL to view brands'
      });
    }

    const brands = await prisma.brand.findMany({
      where: { threeplId },
      include: {
        _count: {
          select: {
            invitations: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      brands
    });
  } catch (error) {
    logger.error('Failed to fetch brands:', error);
    res.status(500).json({
      error: 'Failed to fetch brands',
      message: 'Internal server error'
    });
  }
});

// Get a specific brand by ID
router.get('/:brandId', authenticateToken, requireThreePL, requireOwnThreePL, async (req, res) => {
  try {
    const { brandId } = req.params;
    const authenticatedReq = req as AuthenticatedRequest;
    const threeplId = authenticatedReq.user.threeplId;
    
    if (!threeplId) {
      return res.status(403).json({
        error: '3PL access required',
        message: 'You must be associated with a 3PL to view brands'
      });
    }

    const brand = await prisma.brand.findFirst({
      where: { 
        id: brandId,
        threeplId 
      },
      include: {
        _count: {
          select: {
            invitations: true
          }
        }
      }
    });

    if (!brand) {
      return res.status(404).json({
        error: 'Brand not found',
        message: 'The requested brand does not exist or you do not have access to it'
      });
    }

    res.json({
      success: true,
      brand
    });
  } catch (error) {
    logger.error('Failed to fetch brand:', error);
    res.status(500).json({
      error: 'Failed to fetch brand',
      message: 'Internal server error'
    });
  }
});

// Update a brand
router.put('/:brandId', authenticateToken, requireThreePL, requireOwnThreePL, async (req, res) => {
  try {
    const { brandId } = req.params;
    const authenticatedReq = req as AuthenticatedRequest;
    const threeplId = authenticatedReq.user.threeplId;
    
    if (!threeplId) {
      return res.status(403).json({
        error: '3PL access required',
        message: 'You must be associated with a 3PL to update brands'
      });
    }

    const updateData = {
      name: req.body.name,
      slug: req.body.slug,
      integrationType: req.body.integrationType || null,
      integrationConfig: req.body.integrationConfig || null,
    };

    // Check if brand slug already exists for this 3PL (excluding current brand)
    if (updateData.slug) {
      const existingBrand = await prisma.brand.findFirst({
        where: {
          slug: updateData.slug,
          threeplId,
          id: { not: brandId }
        }
      });

      if (existingBrand) {
        return res.status(409).json({
          error: 'Brand slug already exists',
          message: 'A brand with this slug already exists in your 3PL'
        });
      }
    }

    const updatedBrand = await prisma.brand.update({
      where: { 
        id: brandId,
        threeplId 
      },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Brand updated successfully',
      brand: updatedBrand
    });
  } catch (error) {
    logger.error('Failed to update brand:', error);
    res.status(500).json({
      error: 'Failed to update brand',
      message: 'Internal server error'
    });
  }
});

// Get brand invitations (requires access to the brand)
router.get('/:brandId/invitations', authenticateToken, requireThreePL, requireOwnThreePL, requireOwnBrand, async (req, res) => {
      try {
      const { brandId } = req.params;
      
      const authenticatedReq = req as AuthenticatedRequest;
      
      const invitations = await prisma.brandInvitation.findMany({
      where: { brandId },
      include: { brand: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        accepted: inv.accepted,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt
      }))
    });

  } catch (error) {
    logger.error('Failed to get brand invitations:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get brand invitations'
    });
  }
});

// Invite a user to a brand
router.post('/:brandId/invite', authenticateToken, requireThreePL, requireOwnThreePL, async (req, res) => {
  try {
    const { brandId } = req.params;
    const authenticatedReq = req as AuthenticatedRequest;
    const threeplId = authenticatedReq.user.threeplId;
    
    if (!threeplId) {
      return res.status(403).json({
        error: '3PL access required',
        message: 'You must be associated with a 3PL to invite users'
      });
    }

    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and role are required'
      });
    }

    // Check if brand exists and belongs to this 3PL
    const brand = await prisma.brand.findFirst({
      where: { 
        id: brandId,
        threeplId 
      }
    });

    if (!brand) {
      return res.status(404).json({
        error: 'Brand not found',
        message: 'The requested brand does not exist or you do not have access to it'
      });
    }

    // Check if invitation already exists
    const existingInvitation = await prisma.brandInvitation.findFirst({
      where: {
        email,
        brandId,
        accepted: false
      }
    });

    if (existingInvitation) {
      return res.status(409).json({
        error: 'Invitation already exists',
        message: 'An invitation has already been sent to this email address'
      });
    }

    // Create invitation
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const invitation = await prisma.brandInvitation.create({
      data: {
        email,
        brandId,
        threeplId,
        role,
        token,
        expiresAt
      }
    });

    // Send invitation email
    try {
      const invitationUrl = `${process.env.FRONTEND_URL || 'https://packr.co'}/accept-invitation?token=${invitation.token}`;
      await emailService.sendBrandInvitation(invitation.email, {
        brandName: brand.name,
        threeplName: authenticatedReq.user.email, // You might want to get the actual 3PL name
        role: invitation.role,
        invitationUrl,
        expiresAt: invitation.expiresAt
      });
      logger.info(`Invitation email sent to ${invitation.email}`);
    } catch (emailError) {
      logger.error('Failed to send invitation email:', emailError);
      // Don't fail the request if email fails, but log it
    }

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      invitation
    });
  } catch (error) {
    logger.error('Failed to invite user:', error);
    res.status(500).json({
      error: 'Failed to invite user',
      message: 'Internal server error'
    });
  }
});

// Resend invitation
router.post('/:brandId/invitations/:invitationId/resend', authenticateToken, requireThreePL, requireOwnThreePL, async (req, res) => {
  try {
    const { brandId, invitationId } = req.params;
    const authenticatedReq = req as AuthenticatedRequest;
    const threeplId = authenticatedReq.user.threeplId;
    
    if (!threeplId) {
      return res.status(403).json({
        error: '3PL access required',
        message: 'You must be associated with a 3PL to resend invitations'
      });
    }

    const invitation = await prisma.brandInvitation.findFirst({
      where: {
        id: invitationId,
        brandId,
        threeplId,
        accepted: false
      },
      include: {
        brand: true
      }
    });

    if (!invitation) {
      return res.status(404).json({
        error: 'Invitation not found',
        message: 'The requested invitation does not exist or has already been accepted'
      });
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({
        error: 'Invitation expired',
        message: 'Cannot resend an expired invitation'
      });
    }

    // Generate new token and extend expiration
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const updatedInvitation = await prisma.brandInvitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt
      }
    });

    // Send new invitation email
    try {
      const invitationUrl = `${process.env.FRONTEND_URL || 'https://packr.co'}/accept-invitation?token=${updatedInvitation.token}`;
      await emailService.sendBrandInvitation(invitation.email, {
        brandName: invitation.brand.name,
        threeplName: authenticatedReq.user.email,
        role: invitation.role,
        invitationUrl,
        expiresAt: updatedInvitation.expiresAt
      });
      logger.info(`Resent invitation email to ${invitation.email}`);
    } catch (emailError) {
      logger.error('Failed to resend invitation email:', emailError);
    }

    res.json({
      success: true,
      message: 'Invitation resent successfully',
      invitation: updatedInvitation
    });
  } catch (error) {
    logger.error('Failed to resend invitation:', error);
    res.status(500).json({
      error: 'Failed to resend invitation',
      message: 'Internal server error'
    });
  }
});

// Cancel invitation
router.delete('/:brandId/invitations/:invitationId', authenticateToken, requireThreePL, requireOwnThreePL, async (req, res) => {
  try {
    const { brandId, invitationId } = req.params;
    const authenticatedReq = req as AuthenticatedRequest;
    const threeplId = authenticatedReq.user.threeplId;
    
    if (!threeplId) {
      return res.status(403).json({
        error: '3PL access required',
        message: 'You must be associated with a 3PL to cancel invitations'
      });
    }

    const invitation = await prisma.brandInvitation.findFirst({
      where: {
        id: invitationId,
        brandId,
        threeplId
      }
    });

    if (!invitation) {
      return res.status(404).json({
        error: 'Invitation not found',
        message: 'The requested invitation does not exist'
      });
    }

    await prisma.brandInvitation.delete({
      where: { id: invitationId }
    });

    res.json({
      success: true,
      message: 'Invitation cancelled successfully'
    });
  } catch (error) {
    logger.error('Failed to cancel invitation:', error);
    res.status(500).json({
      error: 'Failed to cancel invitation',
      message: 'Internal server error'
    });
  }
});

export default router;
