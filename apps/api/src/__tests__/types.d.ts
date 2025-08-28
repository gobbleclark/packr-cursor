import { PrismaClient } from '@packr/database';

declare global {
  var testPrisma: PrismaClient;
}
