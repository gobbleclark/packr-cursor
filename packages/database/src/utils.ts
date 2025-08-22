import type { User, Membership } from '@prisma/client';

// RBAC utility functions
export function hasRole(user: User, requiredRole: string): boolean {
  // This would check the user's role from their memberships
  // For now, return false as we need to implement this logic
  return false;
}

export function isSuperAdmin(user: User): boolean {
  return hasRole(user, 'SUPER_ADMIN');
}

export function isThreePLAdmin(user: User): boolean {
  return hasRole(user, 'THREEPL_ADMIN');
}

export function isBrandAdmin(user: User): boolean {
  return hasRole(user, 'BRAND_ADMIN');
}

export async function getUserThreePLs(userId: string, prisma: any) {
  return await prisma.membership.findMany({
    where: { userId, threeplId: { not: null } },
    include: { threepl: true },
  });
}

export async function getUserBrands(userId: string, prisma: any) {
  return await prisma.membership.findMany({
    where: { userId, brandId: { not: null } },
    include: { brand: true },
  });
}

export async function getUserWithMemberships(userId: string, prisma: any) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          threepl: true,
          brand: true,
        },
      },
    },
  });
}
