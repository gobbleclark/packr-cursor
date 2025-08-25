import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// Postmark configuration - will be loaded when service is instantiated
let POSTMARK_API_TOKEN: string | undefined;
let POSTMARK_FROM_EMAIL: string | undefined;

// Function to load environment variables
function loadEnvVars() {
  POSTMARK_API_TOKEN = process.env.POSTMARK_API_TOKEN;
  POSTMARK_FROM_EMAIL = process.env.POSTMARK_FROM_EMAIL || 'noreply@packr.co';
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  returnPath?: string;
  unsubscribeUrl?: string;
  emailType?: 'brand-invitation' | 'password-reset' | 'general';
}

export interface BrandInvitationEmailData {
  brandName: string;
  threeplName: string;
  invitationUrl: string;
  expiresAt: Date;
  role: string;
}

export interface PasswordResetEmailData {
  firstName: string;
  lastName: string;
  resetUrl: string;
  expiresAt: Date;
}

export interface UserInvitationEmailData {
  to: string;
  firstName: string;
  threeplName: string;
  inviterName: string;
  inviteUrl: string;
  role: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | undefined;

  constructor() {
    // Don't initialize transporter here - wait until it's actually needed
  }

  private initializeTransporter() {
    if (this.transporter) return; // Already initialized
    
    // Debug: Check what's being loaded
    console.log('🔍 Email Service Debug:');
    console.log('process.env.POSTMARK_API_TOKEN:', process.env.POSTMARK_API_TOKEN ? 'SET' : 'NOT SET');
    console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
    console.log('All env vars:', Object.keys(process.env).filter(key => key.includes('POSTMARK')));
    console.log('process.env contents:', JSON.stringify(process.env, null, 2));
    
          // Use Postmark if configured, otherwise fall back to SMTP
      if (process.env.POSTMARK_API_TOKEN) {
        // Use Postmark SMTP with Message Stream
        this.transporter = nodemailer.createTransport({
          host: 'smtp.postmarkapp.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.POSTMARK_API_TOKEN,
            pass: process.env.POSTMARK_API_TOKEN
          },
          // Add Postmark-specific headers
          headers: {
            'X-PM-Message-Stream': 'packr'
          }
        });
        logger.info('Using Postmark email service with Message Stream: packr');
    } else if (process.env.NODE_ENV === 'development' && (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com')) {
      // Use Ethereal for development testing
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'ethereal-test-user',
          pass: 'ethereal-test-pass'
        }
      });
      logger.info('Using Ethereal test email service for development');
    } else {
      // Use configured SMTP settings
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || 'your-email@gmail.com',
          pass: process.env.SMTP_PASS || 'your-app-password',
        },
      });
      logger.info('Using SMTP email service');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Initialize transporter if not already done
      this.initializeTransporter();
      
      const mailOptions = {
        from: process.env.POSTMARK_FROM_EMAIL || 'noreply@packr.co',
        ...options,
        headers: {
          'Return-Path': options.returnPath || `bounces@${(process.env.POSTMARK_FROM_EMAIL || 'noreply@packr.co').split('@')[1]}`,
          ...(options.unsubscribeUrl && { 'List-Unsubscribe': `<${options.unsubscribeUrl}>` }),
          'X-Postmark-Tag': options.emailType || 'general', // Track email type in Postmark
          'X-PM-Message-Stream': 'packr', // Postmark Message Stream ID
        }
      };

      const info = await this.transporter!.sendMail(mailOptions);
      logger.info(`Email sent successfully: ${info?.messageId || 'unknown'}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  async sendBrandInvitation(
    email: string,
    data: BrandInvitationEmailData
  ): Promise<boolean> {
    const subject = `You're invited to join ${data.brandName} on Packr`;
    
    // Generate unsubscribe URL
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://packr.co'}/unsubscribe?email=${encodeURIComponent(email)}&type=brand-invitation`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Brand Invitation - Packr</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          .unsubscribe { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .unsubscribe a { color: #6b7280; text-decoration: underline; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 You're Invited!</h1>
          </div>
          <div class="content">
            <p>Hello!</p>
            <p>You've been invited to join <strong>${data.brandName}</strong> on Packr by <strong>${data.threeplName}</strong>.</p>
            
            <p><strong>Your Role:</strong> ${data.role.replace('_', ' ').toLowerCase()}</p>
            
            <p>Click the button below to accept your invitation and set up your account:</p>
            
            <a href="${data.invitationUrl}" class="button">Accept Invitation</a>
            
            <p><strong>Important:</strong> This invitation expires on ${data.expiresAt.toLocaleDateString()} at ${data.expiresAt.toLocaleTimeString()}.</p>
            
            <p>If you have any questions, please contact your 3PL administrator.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Packr. Please do not reply to this email.</p>
          </div>
          <div class="unsubscribe">
            <a href="${unsubscribeUrl}">Unsubscribe from brand invitations</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      You're invited to join ${data.brandName} on Packr!
      
      You've been invited by ${data.threeplName} to join their brand as a ${data.role.replace('_', ' ').toLowerCase()}.
      
      Accept your invitation: ${data.invitationUrl}
      
      This invitation expires on ${data.expiresAt.toLocaleDateString()} at ${data.expiresAt.toLocaleTimeString()}.
      
      If you have questions, contact your 3PL administrator.
      
      To unsubscribe: ${unsubscribeUrl}
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
      returnPath: `bounces@${(process.env.POSTMARK_FROM_EMAIL || 'noreply@packr.co').split('@')[1]}`,
      unsubscribeUrl,
      emailType: 'password-reset',
    });
  }

  async sendPasswordReset(
    email: string,
    data: PasswordResetEmailData
  ): Promise<boolean> {
    const subject = 'Reset your Packr password';
    
    // Generate unsubscribe URL
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://packr.co'}/unsubscribe?email=${encodeURIComponent(email)}&type=password-reset`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Packr</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          .unsubscribe { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .unsubscribe a { color: #6b7280; text-decoration: underline; font-size: 12px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .warning-text { color: #92400e; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello ${data.firstName} ${data.lastName},</p>
            <p>We received a request to reset your password for your Packr account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <a href="${data.resetUrl}" class="button">Reset Password</a>
            
            <div class="warning">
              <p class="warning-text">
                <strong>Security Notice:</strong> This link expires on ${data.expiresAt.toLocaleDateString()} at ${data.expiresAt.toLocaleTimeString()}.
                If you didn't request this password reset, please ignore this email.
              </p>
            </div>
            
            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3B82F6;">${data.resetUrl}</p>
            
            <p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Packr. Please do not reply to this email.</p>
          </div>
          <div class="unsubscribe">
            <a href="${unsubscribeUrl}">Unsubscribe from password reset emails</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset - Packr
      
      Hello ${data.firstName} ${data.lastName},
      
      We received a request to reset your password for your Packr account.
      
      To reset your password, visit this link: ${data.resetUrl}
      
      This link expires on ${data.expiresAt.toLocaleDateString()} at ${data.expiresAt.toLocaleTimeString()}.
      
      If you didn't request this password reset, you can safely ignore this email.
      
      To unsubscribe: ${unsubscribeUrl}
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
      returnPath: `bounces@${(process.env.POSTMARK_FROM_EMAIL || 'noreply@packr.co').split('@')[1]}`,
      unsubscribeUrl,
      emailType: 'brand-invitation',
    });
  }

  async sendUserInvitation(data: UserInvitationEmailData): Promise<boolean> {
    const subject = `You're invited to join ${data.threeplName} on Packr`;
    
    // Generate unsubscribe URL
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://packr.co'}/unsubscribe?email=${encodeURIComponent(data.to)}&type=user-invitation`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation - Packr</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          .unsubscribe { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .unsubscribe a { color: #6b7280; text-decoration: underline; font-size: 12px; }
          .role-badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Join Our Team!</h1>
          </div>
          <div class="content">
            <p>Hello ${data.firstName}!</p>
            <p>You've been invited by <strong>${data.inviterName}</strong> to join the <strong>${data.threeplName}</strong> team on Packr.</p>
            
            <p><strong>Your Role:</strong> <span class="role-badge">${data.role.replace('_', ' ')}</span></p>
            
            <p>Packr is a powerful platform that helps 3PL companies manage their brand clients, orders, and communications all in one place.</p>
            
            <p>Click the button below to accept your invitation and create your account:</p>
            
            <a href="${data.inviteUrl}" class="button">Accept Invitation & Join Team</a>
            
            <p>As a team member, you'll be able to:</p>
            <ul>
              <li>Manage brand clients and their orders</li>
              <li>Communicate with team members and brands</li>
              <li>Track shipments and inventory</li>
              <li>Access powerful analytics and reporting</li>
            </ul>
            
            <p>If you have any questions about this invitation, please contact <strong>${data.inviterName}</strong> directly.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Packr. Please do not reply to this email.</p>
          </div>
          <div class="unsubscribe">
            <a href="${unsubscribeUrl}">Unsubscribe from team invitations</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Join Our Team on Packr!
      
      Hello ${data.firstName}!
      
      You've been invited by ${data.inviterName} to join the ${data.threeplName} team on Packr as a ${data.role.replace('_', ' ')}.
      
      Accept your invitation: ${data.inviteUrl}
      
      Packr helps 3PL companies manage brand clients, orders, and communications all in one place.
      
      If you have questions, contact ${data.inviterName} directly.
      
      To unsubscribe: ${unsubscribeUrl}
    `;

    return this.sendEmail({
      to: data.to,
      subject,
      html,
      text,
      returnPath: `bounces@${(process.env.POSTMARK_FROM_EMAIL || 'noreply@packr.co').split('@')[1]}`,
      unsubscribeUrl,
      emailType: 'general',
    });
  }

  // Test method for development
  async testConnection(): Promise<boolean> {
    try {
      this.initializeTransporter();
      await this.transporter!.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }

  // Test method for development - sends a test email
  async sendTestEmail(to: string): Promise<boolean> {
    try {
      const testResult = await this.sendEmail({
        to,
        subject: 'Test Email from Packr',
        html: `
          <h1>Test Email</h1>
          <p>This is a test email to verify your email configuration.</p>
          <p>If you receive this, your email service is working correctly!</p>
        `,
        text: 'This is a test email to verify your email configuration.',
        emailType: 'general',
      });
      
      if (testResult) {
        logger.info(`Test email sent successfully to ${to}`);
      } else {
        logger.error('Test email failed to send');
      }
      
      return testResult;
    } catch (error) {
      logger.error('Test email error:', error);
      return false;
    }
  }

  // Batch send emails for better Postmark performance
  async sendBatchEmails(emails: EmailOptions[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    // Process emails in batches of 10 (Postmark recommendation)
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      try {
        const batchPromises = batch.map(email => this.sendEmail(email));
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push(`Failed to send to ${batch[index].to}`);
          }
        });
        
        // Small delay between batches to respect rate limits
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error('Batch email error:', error);
        results.failed += batch.length;
        results.errors.push(`Batch failed: ${error}`);
      }
    }
    
    logger.info(`Batch email results: ${results.success} successful, ${results.failed} failed`);
    return results;
  }
}

export const emailService = new EmailService();
