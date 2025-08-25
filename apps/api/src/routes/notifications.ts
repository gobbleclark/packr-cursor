import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@packr/database';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation schema
const updateNotificationPreferencesSchema = z.object({
  emailOnMention: z.boolean().optional(),
  emailOnAssignment: z.boolean().optional(),
  emailOnComment: z.boolean().optional(),
  emailOnMessageUpdate: z.boolean().optional(),
  digestFrequency: z.enum(['IMMEDIATE', 'DAILY', 'WEEKLY', 'NEVER']).optional(),
});

// Get user's notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    let preferences = await prisma.notificationPreference.findUnique({
      where: {
        userId: req.user.id,
      }
    });

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: {
          userId: req.user.id,
        }
      });
    }

    res.json({ success: true, preferences });
  } catch (error) {
    logger.error('Failed to fetch notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Update user's notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const data = updateNotificationPreferencesSchema.parse(req.body);

    const preferences = await prisma.notificationPreference.upsert({
      where: {
        userId: req.user.id,
      },
      update: data,
      create: {
        userId: req.user.id,
        ...data,
      }
    });

    res.json({ success: true, preferences });
  } catch (error) {
    logger.error('Failed to update notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

export default router;
