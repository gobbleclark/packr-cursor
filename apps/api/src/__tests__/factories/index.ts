import { PrismaClient } from '@packr/database';

const prisma = new PrismaClient();

export interface TestThreePL {
  id: string;
  name: string;
  slug: string;
}

export interface TestBrand {
  id: string;
  name: string;
  slug: string;
  threeplId: string;
}

export interface TestUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface TestProduct {
  id: string;
  threeplId: string;
  brandId: string;
  sku: string;
  name: string;
  externalId: string;
}

export interface TestOrder {
  id: string;
  threeplId: string;
  brandId: string;
  externalId: string;
  orderNumber: string;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  total: number;
}

export class TestDataFactory {
  static async createThreePL(overrides: Partial<TestThreePL> = {}): Promise<TestThreePL> {
    const data = {
      name: 'Test 3PL',
      slug: 'test-3pl',
      ...overrides
    };

    const threepl = await prisma.threePL.create({ data });
    return threepl;
  }

  static async createBrand(threeplId: string, overrides: Partial<TestBrand> = {}): Promise<TestBrand> {
    const data = {
      name: 'Test Brand',
      slug: 'test-brand',
      threeplId,
      ...overrides
    };

    const brand = await prisma.brand.create({ data });
    return brand;
  }

  static async createUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const data = {
      clerkId: `clerk_${Math.random().toString(36).substr(2, 9)}`,
      email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      ...overrides
    };

    const user = await prisma.user.create({ data });
    return user;
  }

  static async createProduct(threeplId: string, brandId: string, overrides: Partial<TestProduct> = {}): Promise<TestProduct> {
    const sku = `TEST-SKU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const data = {
      threeplId,
      brandId,
      sku,
      name: `Test Product ${sku}`,
      externalId: `ext_${Math.random().toString(36).substr(2, 9)}`,
      ...overrides
    };

    const product = await prisma.product.create({ data });
    return product;
  }

  static async createOrder(threeplId: string, brandId: string, overrides: Partial<TestOrder> = {}): Promise<TestOrder> {
    const orderNumber = `ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const data = {
      threeplId,
      brandId,
      orderNumber,
      externalId: `ext_${Math.random().toString(36).substr(2, 9)}`,
      customerId: 'test-customer',
      status: 'PENDING' as const,
      total: 100.00,
      subtotal: 90.00,
      ...overrides
    };

    const order = await prisma.order.create({ data });
    return order;
  }

  static async createBrandIntegration(brandId: string, overrides: any = {}) {
    const data = {
      brandId,
      provider: 'TRACKSTAR' as const,
      status: 'ACTIVE' as const,
      accessToken: 'test-access-token',
      connectionId: `conn_${Math.random().toString(36).substr(2, 9)}`,
      integrationName: 'Test Integration',
      availableActions: ['get_orders', 'get_products', 'get_inventory'],
      ...overrides
    };

    return await prisma.brandIntegration.create({ data });
  }

  static async createInventoryItem(tenantId: string, brandId: string, sku: string, overrides: any = {}) {
    const data = {
      tenantId,
      brandId,
      sku,
      productName: `Product ${sku}`,
      onHand: 100,
      available: 95,
      committed: 5,
      ...overrides
    };

    return await prisma.inventoryItem.create({ data });
  }

  static async createWarehouse(tenantId: string, overrides: any = {}) {
    const data = {
      tenantId,
      externalId: `wh_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Test Warehouse',
      active: true,
      ...overrides
    };

    return await prisma.warehouse.create({ data });
  }

  // Clean up all test data
  static async cleanup() {
    await prisma.orderItem.deleteMany();
    await prisma.orderNote.deleteMany();
    await prisma.shipment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.inventorySnapshot.deleteMany();
    await prisma.product.deleteMany();
    await prisma.brandIntegration.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.brand.deleteMany();
    await prisma.user.deleteMany();
    await prisma.warehouse.deleteMany();
    await prisma.threePL.deleteMany();
    await prisma.webhookEventV2.deleteMany();
  }
}

export default TestDataFactory;
