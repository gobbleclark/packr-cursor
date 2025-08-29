import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/database';
import { hash, compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { emailService } from '../services/emailService';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
  companySlug: z.string().min(3).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

// Helper function to generate JWT token
const generateToken = (userId: string, email: string, role: string) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET || 'dev-secret-key',
    { expiresIn: '7d' }
  );
};

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            threepl: true,
            brand: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Verify password using bcrypt
    const isValidPassword = await compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Get user's primary membership
    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      return res.status(403).json({
        error: 'No access',
        message: 'User has no active memberships',
      });
    }

    // Generate token
    const token = generateToken(user.id, user.email, primaryMembership.role);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: primaryMembership.role,
        threeplId: primaryMembership.threeplId,
        brandId: primaryMembership.brandId,
        companyName: primaryMembership.threepl?.name || primaryMembership.brand?.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process login',
    });
  }
});

// 3PL Signup endpoint
router.post('/signup', async (req, res) => {
  try {
    const signupData = signupSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: signupData.email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'A user with this email already exists',
      });
    }

    // Check if company slug already exists
    const existingThreePL = await prisma.threePL.findUnique({
      where: { slug: signupData.companySlug },
    });

    if (existingThreePL) {
      return res.status(409).json({
        error: 'Company slug already exists',
        message: 'This company URL is already taken',
      });
    }

    // Create user and 3PL in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create 3PL
      const threepl = await tx.threePL.create({
        data: {
          name: signupData.companyName,
          slug: signupData.companySlug,
          settings: "{}",
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          clerkId: `clerk_${Date.now()}`, // Placeholder for Clerk integration
          email: signupData.email,
          firstName: signupData.firstName,
          lastName: signupData.lastName,
        },
      });

      // Create membership (3PL Admin)
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          threeplId: threepl.id,
          role: 'THREEPL_ADMIN',
        },
      });

      // Create default message statuses
      await tx.messageStatus.createMany({
        data: [
          { threeplId: threepl.id, name: 'Open', color: '#10B981', isDefault: true },
          { threeplId: threepl.id, name: 'In Progress', color: '#F59E0B', isDefault: false },
          { threeplId: threepl.id, name: 'Resolved', color: '#3B82F6', isDefault: false },
          { threeplId: threepl.id, name: 'Closed', color: '#6B7280', isDefault: false },
        ],
      });

      return { user, threepl, membership };
    });

    // Generate token
    const token = generateToken(result.user.id, result.user.email, 'THREEPL_ADMIN');

    res.status(201).json({
      success: true,
      message: '3PL account created successfully',
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: 'THREEPL_ADMIN',
        threeplId: result.threepl.id,
        companyName: result.threepl.name,
        companySlug: result.threepl.slug,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create account',
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authorization header is required',
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key') as any;
      
      // Get user with memberships
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          memberships: {
            include: {
              threepl: true,
              brand: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'User not found',
        });
      }

      const primaryMembership = user.memberships[0];
      
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: primaryMembership?.role,
          threeplId: primaryMembership?.threeplId,
          brandId: primaryMembership?.brandId,
          companyName: primaryMembership?.threepl?.name || primaryMembership?.brand?.name,
        },
      });
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired',
      });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify token',
    });
  }
});

// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, we\'ve sent a password reset link.',
      });
    }

    // Note: Rate limiting removed for development - users can request multiple resets
    // In production, you might want to add rate limiting back

    // Clean up any existing unused tokens for this user
    await prisma.passwordReset.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    });

    // Generate reset token and expiration (1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save password reset token
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send password reset email
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'https://packr.co'}/reset-password?token=${token}`;
      
      await emailService.sendPasswordReset(user.email, {
        firstName: user.firstName,
        lastName: user.lastName,
        resetUrl,
        expiresAt,
      });
      
      console.log(`Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't fail the request if email fails, but log it
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, we\'ve sent a password reset link.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process password reset request',
    });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    // Find valid password reset token
    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        token,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!passwordReset) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'The password reset token is invalid or has expired.',
      });
    }

    // Hash new password
    const hashedPassword = await hash(password, 12);

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: passwordReset.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.update({
        where: { id: passwordReset.id },
        data: { used: true },
      }),
    ]);

    // Invalidate all other password reset tokens for this user
    await prisma.passwordReset.updateMany({
      where: {
        userId: passwordReset.userId,
        used: false,
        id: { not: passwordReset.id },
      },
      data: { used: true },
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to reset password',
    });
  }
});

// Test email service configuration endpoint - DISABLED IN PRODUCTION
// router.get('/test-email-config', async (req, res) => {
  try {
    // Check environment variables
    const config = {
      postmarkToken: process.env.POSTMARK_API_TOKEN ? 'SET' : 'NOT SET',
      postmarkFromEmail: process.env.POSTMARK_FROM_EMAIL || 'NOT SET',
      postmarkMessageStream: 'packr',
      nodeEnv: process.env.NODE_ENV,
      emailServiceType: 'Postmark SMTP',
    };

    // Test email service connection
    let connectionTest = 'Not tested';
    try {
      await emailService.testConnection();
      connectionTest = 'SUCCESS';
    } catch (error) {
      connectionTest = `FAILED: ${error}`;
    }

    res.json({
      success: true,
      config,
      connectionTest,
      message: 'Email service configuration check completed',
    });
  } catch (error) {
    console.error('Email config test error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to test email configuration',
    });
  }
});

// Test email sending endpoint - DISABLED IN PRODUCTION  
// router.post('/test-email-send', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Please provide an email address to send the test to',
      });
    }

    console.log(`🧪 Testing email sending to: ${email}`);
    
    // Send a test email
    const result = await emailService.sendTestEmail(email);
    
    if (result) {
      console.log(`✅ Test email sent successfully to ${email}`);
      res.json({
        success: true,
        message: `Test email sent successfully to ${email}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log(`❌ Test email failed to send to ${email}`);
      res.status(500).json({
        error: 'Email sending failed',
        message: 'Test email failed to send',
      });
    }
  } catch (error) {
    console.error('Test email sending error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: `Failed to send test email: ${error}`,
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        threepl: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        brand: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        threeplId: user.threeplId,
        brandId: user.brandId,
        companyName: user.threepl?.name || user.brand?.name,
        companySlug: user.threepl?.slug || user.brand?.slug
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

export default router;
