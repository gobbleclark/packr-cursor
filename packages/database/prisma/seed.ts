import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a 3PL company
  const threepl = await prisma.threePL.upsert({
    where: { slug: 'demo-3pl' },
    update: {},
    create: {
      name: 'Demo 3PL',
      slug: 'demo-3pl',
    },
  });

  // Create a brand
  const brand = await prisma.brand.upsert({
    where: { threeplId_slug: { threeplId: threepl.id, slug: 'demo-brand' } },
    update: {},
    create: {
      name: 'Demo Brand',
      slug: 'demo-brand',
      threeplId: threepl.id,
    },
  });

  // Create a 3PL user
  const threeplUser = await prisma.user.upsert({
    where: { email: '3pl@demo.com' },
    update: {},
    create: {
      clerkId: 'clerk_3pl_demo',
      email: '3pl@demo.com',
      firstName: 'John',
      lastName: 'Doe',
      password: '$2b$10$rQJ8kHqfH.pQJ8kHqfH.pOJ8kHqfH.pQJ8kHqfH.pQJ8kHqfH.pQJ8k', // password: "password"
    },
  });

  // Create membership for 3PL user
  await prisma.membership.upsert({
    where: { userId_threeplId_brandId: { userId: threeplUser.id, threeplId: threepl.id, brandId: null } },
    update: {},
    create: {
      userId: threeplUser.id,
      threeplId: threepl.id,
      role: 'THREEPL_ADMIN',
    },
  });

  // Create a brand user
  const brandUser = await prisma.user.upsert({
    where: { email: 'brand@demo.com' },
    update: {},
    create: {
      clerkId: 'clerk_brand_demo',
      email: 'brand@demo.com',
      firstName: 'Jane',
      lastName: 'Smith',
      password: '$2b$10$rQJ8kHqfH.pQJ8kHqfH.pOJ8kHqfH.pQJ8kHqfH.pQJ8kHqfH.pQJ8k', // password: "password"
    },
  });

  // Create membership for brand user
  await prisma.membership.upsert({
    where: { userId_threeplId_brandId: { userId: brandUser.id, threeplId: threepl.id, brandId: brand.id } },
    update: {},
    create: {
      userId: brandUser.id,
      threeplId: threepl.id,
      brandId: brand.id,
      role: 'BRAND_USER',
    },
  });

  // Create some sample orders
  const orders = [];
  for (let i = 1; i <= 10; i++) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${String(i).padStart(4, '0')}`,
        externalId: `ext-${i}`,
        customerId: `customer-${i}`,
        customerName: `Customer ${i}`,
        customerEmail: `customer${i}@example.com`,
        status: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'][i % 4],
        total: Math.floor(Math.random() * 500) + 50,
        subtotal: Math.floor(Math.random() * 400) + 40,
        tax: Math.floor(Math.random() * 50) + 5,
        shipping: Math.floor(Math.random() * 20) + 5,
        threeplId: threepl.id,
        brandId: brand.id,
        metadata: {
          source: 'seed',
          required_ship_date_parsed: new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    });
    orders.push(order);
  }

  console.log(`✅ Created ${orders.length} sample orders`);
  console.log(`✅ Created 3PL: ${threepl.name}`);
  console.log(`✅ Created Brand: ${brand.name}`);
  console.log(`✅ Created users: 3pl@demo.com, brand@demo.com (password: "password")`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
