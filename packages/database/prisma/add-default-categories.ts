import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addDefaultCategories() {
  console.log('🏷️  Adding default task categories...');

  // Get all 3PLs
  const threepls = await prisma.threePL.findMany();

  const defaultCategories = [
    {
      name: 'Shipment',
      description: 'Tasks related to shipping and fulfillment',
      color: '#3B82F6', // Blue
      isDefault: true,
    },
    {
      name: 'Tracking',
      description: 'Tasks related to order tracking and updates',
      color: '#10B981', // Green
      isDefault: true,
    },
    {
      name: 'Inventory',
      description: 'Tasks related to inventory management',
      color: '#F59E0B', // Yellow
      isDefault: true,
    },
    {
      name: 'Customer Service',
      description: 'Tasks related to customer support and communication',
      color: '#8B5CF6', // Purple
      isDefault: true,
    },
    {
      name: 'Returns',
      description: 'Tasks related to returns and refunds',
      color: '#EF4444', // Red
      isDefault: true,
    },
    {
      name: 'General',
      description: 'General tasks and miscellaneous items',
      color: '#6B7280', // Gray
      isDefault: true,
    },
  ];

  for (const threepl of threepls) {
    console.log(`Adding categories for ${threepl.name}...`);
    
    for (const category of defaultCategories) {
      await prisma.taskCategory.upsert({
        where: {
          threeplId_name: {
            threeplId: threepl.id,
            name: category.name,
          },
        },
        update: {},
        create: {
          ...category,
          threeplId: threepl.id,
        },
      });
    }
  }

  console.log('✅ Default task categories added successfully!');
}

addDefaultCategories()
  .catch((e) => {
    console.error('❌ Error adding default categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
