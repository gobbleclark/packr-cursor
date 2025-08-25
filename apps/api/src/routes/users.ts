import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@packr/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { emailService } from '../services/emailService';

const router = Router();

// Validation schemas
const inviteUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['THREEPL_ADMIN', 'THREEPL_USER']),
  allowedBrandIds: z.array(z.string()).optional().default([]),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  role: z.enum(['THREEPL_ADMIN', 'THREEPL_USER']).optional(),
  isActive: z.boolean().optional(),
  allowedBrandIds: z.array(z.string()).optional(),
});

const acceptInvitationSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

// Get all users for the 3PL
router.get('/', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const { page = '1', limit = '20', search, role, isActive } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      memberships: {
        some: {
          threeplId: req.user.threeplId,
        }
      }
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          memberships: {
            where: {
              threeplId: req.user.threeplId,
            },
            include: {
              brand: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                }
              }
            }
          }
        },
        orderBy: [
          { isActive: 'desc' },
          { firstName: 'asc' },
          { lastName: 'asc' }
        ],
        skip,
        take: limitNum,
      }),
      prisma.user.count({ where })
    ]);

    // Filter by role if specified
    let filteredUsers = users;
    if (role) {
      filteredUsers = users.filter(user => 
        user.memberships.some(m => m.role === role)
      );
    }

    res.json({
      success: true,
      users: filteredUsers.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        allowedBrandIds: user.allowedBrandIds,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.memberships[0]?.role,
        brands: user.memberships.map(m => m.brand).filter(Boolean),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: role ? filteredUsers.length : total,
        pages: Math.ceil((role ? filteredUsers.length : total) / limitNum),
      }
    });
  } catch (error) {
    logger.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get a specific user
router.get('/:userId', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        memberships: {
          some: {
            threeplId: req.user.threeplId,
          }
        }
      },
      include: {
        memberships: {
          where: {
            threeplId: req.user.threeplId,
          },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                slug: true,
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        allowedBrandIds: user.allowedBrandIds,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.memberships[0]?.role,
        brands: user.memberships.map(m => m.brand).filter(Boolean),
      }
    });
  } catch (error) {
    logger.error('Failed to fetch user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Invite a new user
router.post('/invite', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const data = inviteUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      // Check if they already have a membership with this 3PL
      const existingMembership = await prisma.membership.findFirst({
        where: {
          userId: existingUser.id,
          threeplId: req.user.threeplId,
        }
      });

      if (existingMembership) {
        return res.status(400).json({ error: 'User is already a member of this 3PL' });
      }
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create user invitation record
    const invitation = await prisma.userInvitation.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        allowedBrandIds: data.allowedBrandIds,
        threeplId: req.user.threeplId,
        token,
        expiresAt,
      }
    });

    // Get 3PL info for email
    const threepl = await prisma.threePL.findUnique({
      where: { id: req.user.threeplId }
    });

    // Send invitation email
    try {
      await emailService.sendUserInvitation({
        to: data.email,
        firstName: data.firstName,
        threeplName: threepl?.name || '3PL',
        inviterName: `${req.user.firstName} ${req.user.lastName}`,
        inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-user-invitation?token=${token}`,
        role: data.role,
      });
    } catch (emailError) {
      logger.error('Failed to send invitation email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'User invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      }
    });
  } catch (error) {
    logger.error('Failed to invite user:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Accept user invitation
router.post('/accept-invitation', async (req, res) => {
  try {
    const { token, password } = acceptInvitationSchema.parse(req.body);

    const invitation = await prisma.userInvitation.findFirst({
      where: {
        token,
        accepted: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!invitation) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create or update user
    let user = await prisma.user.findUnique({
      where: { email: invitation.email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: `user_${crypto.randomBytes(16).toString('hex')}`,
          email: invitation.email,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          password: hashedPassword,
          allowedBrandIds: invitation.allowedBrandIds,
        }
      });
    } else {
      // Update existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          allowedBrandIds: invitation.allowedBrandIds,
          isActive: true,
        }
      });
    }

    // Create membership
    await prisma.membership.create({
      data: {
        userId: user.id,
        threeplId: invitation.threeplId,
        role: invitation.role,
      }
    });

    // Mark invitation as accepted
    await prisma.userInvitation.update({
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
        lastName: user.lastName,
      }
    });
  } catch (error) {
    logger.error('Failed to accept invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Update a user
router.put('/:userId', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const { userId } = req.params;
    const data = updateUserSchema.parse(req.body);

    // Verify user belongs to this 3PL
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        memberships: {
          some: {
            threeplId: req.user.threeplId,
          }
        }
      },
      include: {
        memberships: {
          where: {
            threeplId: req.user.threeplId,
          }
        }
      }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        isActive: data.isActive,
        allowedBrandIds: data.allowedBrandIds,
      }
    });

    // Update membership role if provided
    if (data.role && existingUser.memberships[0]) {
      await prisma.membership.update({
        where: { id: existingUser.memberships[0].id },
        data: { role: data.role }
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        isActive: updatedUser.isActive,
        allowedBrandIds: updatedUser.allowedBrandIds,
        role: data.role || existingUser.memberships[0]?.role,
      }
    });
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Deactivate a user (soft delete)
router.delete('/:userId', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user belongs to this 3PL
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        memberships: {
          some: {
            threeplId: req.user.threeplId,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Deactivate user instead of deleting
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error('Failed to deactivate user:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Get user invitations
router.get('/invitations/list', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const invitations = await prisma.userInvitation.findMany({
      where: {
        threeplId: req.user.threeplId,
        accepted: false,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, invitations });
  } catch (error) {
    logger.error('Failed to fetch invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Resend user invitation
router.post('/invitations/:invitationId/resend', authenticateToken, requireRole('THREEPL_ADMIN'), async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await prisma.userInvitation.findFirst({
      where: {
        id: invitationId,
        threeplId: req.user.threeplId,
        accepted: false,
      }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Extend expiration
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.userInvitation.update({
      where: { id: invitationId },
      data: { expiresAt: newExpiresAt }
    });

    // Get 3PL info for email
    const threepl = await prisma.threePL.findUnique({
      where: { id: req.user.threeplId }
    });

    // Resend invitation email
    try {
      await emailService.sendUserInvitation({
        to: invitation.email,
        firstName: invitation.firstName,
        threeplName: threepl?.name || '3PL',
        inviterName: `${req.user.firstName} ${req.user.lastName}`,
        inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-user-invitation?token=${invitation.token}`,
        role: invitation.role,
      });
    } catch (emailError) {
      logger.error('Failed to resend invitation email:', emailError);
      return res.status(500).json({ error: 'Failed to resend invitation email' });
    }

    res.json({
      success: true,
      message: 'Invitation resent successfully'
    });
  } catch (error) {
    logger.error('Failed to resend invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

export default router;
