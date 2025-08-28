import { Svix } from 'svix';

const webhookSecret = process.env.WEBHOOK_TRACKSTAR_SECRET || 'dev-secret';

export const svix = new Svix(webhookSecret, {
  debug: process.env.NODE_ENV === 'development',
});
