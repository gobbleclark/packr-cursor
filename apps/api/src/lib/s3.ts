import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { logger } from '../utils/logger';

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET || 'packr-chat-files';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: metadata,
        // Make files publicly readable (you might want to adjust this based on security needs)
        ACL: 'public-read',
      });

      await this.s3Client.send(command);
      
      const fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      logger.info(`File uploaded to S3: ${fileUrl}`);
      
      return fileUrl;
    } catch (error) {
      logger.error('Error uploading file to S3:', error);
      throw new Error('Failed to upload file');
    }
  }

  /**
   * Generate a presigned URL for file upload (client-side uploads)
   */
  async generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: mimeType,
        ACL: 'public-read',
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return presignedUrl;
    } catch (error) {
      logger.error('Error generating presigned upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Generate a presigned URL for file download
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return presignedUrl;
    } catch (error) {
      logger.error('Error generating presigned download URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      logger.info(`File deleted from S3: ${key}`);
    } catch (error) {
      logger.error('Error deleting file from S3:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Create thumbnail for images
   */
  async createThumbnail(
    originalBuffer: Buffer,
    width: number = 300,
    height: number = 300
  ): Promise<Buffer> {
    try {
      const thumbnail = await sharp(originalBuffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      return thumbnail;
    } catch (error) {
      logger.error('Error creating thumbnail:', error);
      throw new Error('Failed to create thumbnail');
    }
  }

  /**
   * Generate unique file key
   */
  generateFileKey(
    userId: string,
    roomId: string,
    originalFilename: string,
    prefix: string = 'chat'
  ): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalFilename.split('.').pop();
    
    return `${prefix}/${roomId}/${userId}/${timestamp}-${randomString}.${extension}`;
  }

  /**
   * Generate thumbnail key from original key
   */
  generateThumbnailKey(originalKey: string): string {
    const parts = originalKey.split('.');
    const extension = parts.pop();
    const baseName = parts.join('.');
    
    return `${baseName}_thumb.jpg`;
  }

  /**
   * Check if file type is an image
   */
  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Get file size limit based on file type
   */
  getFileSizeLimit(mimeType: string): number {
    if (this.isImageFile(mimeType)) {
      return 10 * 1024 * 1024; // 10MB for images
    }
    return 50 * 1024 * 1024; // 50MB for other files
  }

  /**
   * Validate file type
   */
  isAllowedFileType(mimeType: string): boolean {
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text files
      'text/plain',
      'text/csv',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      // Other
      'application/json',
    ];

    return allowedTypes.includes(mimeType);
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

// Export singleton instance
export const s3Service = new S3Service();

