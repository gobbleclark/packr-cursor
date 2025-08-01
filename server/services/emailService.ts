import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY!);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      ...(params.text && { text: params.text }),
      ...(params.html && { html: params.html }),
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendBrandInvitationEmail(
  brandName: string,
  brandEmail: string,
  invitationLink: string,
  threePlName: string
): Promise<boolean> {
  const subject = `You're invited to join ${threePlName}'s 3PL Platform`;
  
  const text = `
Hi there,

You've been invited to join ${threePlName}'s 3PL platform as ${brandName}.

What you'll get access to:
• Order management and tracking
• Real-time inventory visibility  
• Support ticket system
• Integration with WMS platforms

Click here to accept your invitation:
${invitationLink}

If you have any questions, please contact ${threePlName} directly.

Best regards,
The 3PL Platform Team
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3PL Platform Invitation</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .features { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .feature { margin: 10px 0; padding-left: 20px; position: relative; }
    .feature:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're Invited!</h1>
      <p>Join ${threePlName}'s 3PL Platform</p>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>You've been invited to join <strong>${threePlName}'s 3PL platform</strong> as <strong>${brandName}</strong>.</p>
      
      <div class="features">
        <h3>What you'll get access to:</h3>
        <div class="feature">Order management and tracking</div>
        <div class="feature">Real-time inventory visibility</div>
        <div class="feature">Support ticket system</div>
        <div class="feature">Integration with WMS platforms</div>
      </div>

      <div style="text-align: center;">
        <a href="${invitationLink}" class="button">Accept Invitation</a>
      </div>

      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-family: monospace;">
        ${invitationLink}
      </p>

      <p>If you have any questions, please contact ${threePlName} directly.</p>
      
      <div class="footer">
        <p>Best regards,<br>The 3PL Platform Team</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: brandEmail,
    from: 'noreply@3plplatform.com', // You may want to configure this
    subject,
    text,
    html,
  });
}