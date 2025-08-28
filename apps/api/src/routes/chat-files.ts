import express from 'express';
import multer from 'multer';
import { prisma } from '@packr/database';
import { authenticateToken } from '../middleware/auth';
import { s3Service } from '../lib/s3';
import { logger } from '../utils/logger';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (s3Service.isAllowedFileType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

/**
 * Upload file to chat room
 * POST /api/chat/rooms/:roomId/upload
 */
router.post('/rooms/:roomId/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    // Check file size limit
    const sizeLimit = s3Service.getFileSizeLimit(file.mimetype);
    if (file.size > sizeLimit) {
      return res.status(400).json({ 
        error: `File too large. Maximum size is ${Math.round(sizeLimit / 1024 / 1024)}MB` 
      });
    }

    // Generate unique file key
    const fileKey = s3Service.generateFileKey(userId, roomId, file.originalname);
    
    // Upload file to S3
    const fileUrl = await s3Service.uploadFile(
      fileKey,
      file.buffer,
      file.mimetype,
      {
        userId,
        roomId,
        originalName: file.originalname,
      }
    );

    // Create thumbnail for images
    let thumbnailKey: string | null = null;
    let thumbnailUrl: string | null = null;
    
    if (s3Service.isImageFile(file.mimetype)) {
      try {
        thumbnailKey = s3Service.generateThumbnailKey(fileKey);
        const thumbnailBuffer = await s3Service.createThumbnail(file.buffer);
        thumbnailUrl = await s3Service.uploadFile(
          thumbnailKey,
          thumbnailBuffer,
          'image/jpeg'
        );
      } catch (error) {
        logger.warn('Failed to create thumbnail:', error);
        // Continue without thumbnail
      }
    }

    // Create message with attachment
    const message = await prisma.chatMessage.create({
      data: {
        roomId,
        userId,
        content: file.originalname, // Use filename as content
        messageType: s3Service.isImageFile(file.mimetype) ? 'IMAGE' : 'FILE',
        attachments: {
          create: {
            filename: fileKey,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            s3Key: fileKey,
            s3Bucket: process.env.AWS_S3_BUCKET || 'packr-chat-files',
            thumbnailKey,
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        attachments: true
      }
    });

    // Add file URLs to response
    const messageWithUrls = {
      ...message,
      attachments: message.attachments.map(attachment => ({
        ...attachment,
        url: fileUrl,
        thumbnailUrl: thumbnailUrl || null
      }))
    };

    res.json({
      success: true,
      message: messageWithUrls
    });

    logger.info(`File uploaded to chat room ${roomId} by user ${userId}: ${file.originalname}`);
  } catch (error) {
    logger.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

/**
 * Generate presigned upload URL for client-side uploads
 * POST /api/chat/rooms/:roomId/upload-url
 */
router.post('/rooms/:roomId/upload-url', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { filename, mimeType } = req.body;
    const userId = req.user.id;

    if (!filename || !mimeType) {
      return res.status(400).json({ error: 'Filename and mimeType required' });
    }

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    // Validate file type
    if (!s3Service.isAllowedFileType(mimeType)) {
      return res.status(400).json({ error: 'File type not allowed' });
    }

    // Generate unique file key
    const fileKey = s3Service.generateFileKey(userId, roomId, filename);

    // Generate presigned URL
    const uploadUrl = await s3Service.generatePresignedUploadUrl(fileKey, mimeType);
    const fileUrl = s3Service.getPublicUrl(fileKey);

    res.json({
      success: true,
      uploadUrl,
      fileKey,
      fileUrl
    });
  } catch (error) {
    logger.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

/**
 * Confirm file upload and create message
 * POST /api/chat/rooms/:roomId/confirm-upload
 */
router.post('/rooms/:roomId/confirm-upload', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { fileKey, originalName, mimeType, fileSize } = req.body;
    const userId = req.user.id;

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this chat room' });
    }

    // Create message with attachment
    const message = await prisma.chatMessage.create({
      data: {
        roomId,
        userId,
        content: originalName,
        messageType: s3Service.isImageFile(mimeType) ? 'IMAGE' : 'FILE',
        attachments: {
          create: {
            filename: fileKey,
            originalName,
            mimeType,
            fileSize: parseInt(fileSize),
            s3Key: fileKey,
            s3Bucket: process.env.AWS_S3_BUCKET || 'packr-chat-files',
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        attachments: true
      }
    });

    // Add file URL to response
    const messageWithUrls = {
      ...message,
      attachments: message.attachments.map(attachment => ({
        ...attachment,
        url: s3Service.getPublicUrl(attachment.s3Key)
      }))
    };

    res.json({
      success: true,
      message: messageWithUrls
    });
  } catch (error) {
    logger.error('Error confirming file upload:', error);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

/**
 * Get file download URL
 * GET /api/chat/attachments/:attachmentId/download
 */
router.get('/attachments/:attachmentId/download', authenticateToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user.id;

    // Get attachment and verify access
    const attachment = await prisma.chatAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            room: true
          }
        }
      }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Verify user has access to the room
    const hasAccess = await verifyRoomAccess(userId, attachment.message.roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate download URL
    const downloadUrl = await s3Service.generatePresignedDownloadUrl(attachment.s3Key);

    res.json({
      success: true,
      downloadUrl,
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize
    });
  } catch (error) {
    logger.error('Error generating download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

/**
 * Delete attachment
 * DELETE /api/chat/attachments/:attachmentId
 */
router.delete('/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user.id;

    // Get attachment and verify access
    const attachment = await prisma.chatAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            room: true,
            user: true
          }
        }
      }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Only allow deletion by message author or room admin
    if (attachment.message.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete from S3
    await s3Service.deleteFile(attachment.s3Key);
    
    // Delete thumbnail if exists
    if (attachment.thumbnailKey) {
      try {
        await s3Service.deleteFile(attachment.thumbnailKey);
      } catch (error) {
        logger.warn('Failed to delete thumbnail:', error);
      }
    }

    // Delete from database
    await prisma.chatAttachment.delete({
      where: { id: attachmentId }
    });

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// Helper function to verify room access
async function verifyRoomAccess(userId: string, roomId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true }
    });

    if (!user) return false;

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId }
    });

    if (!room) return false;

    // Check if user has membership that gives access to this room
    return user.memberships.some(membership => {
      if (membership.role.includes('THREEPL')) {
        // 3PL users can access any room for their 3PL
        return membership.threeplId === room.threeplId;
      } else if (membership.role.includes('BRAND')) {
        // Brand users can only access their specific brand's room
        return membership.threeplId === room.threeplId && 
               membership.brandId === room.brandId;
      }
      return false;
    });
  } catch (error) {
    logger.error('Error verifying room access:', error);
    return false;
  }
}

export default router;
