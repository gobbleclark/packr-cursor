const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStatus() {
  try {
    console.log('📊 Current Inbound Shipments Status\n');
    
    // Count total inbound shipments
    const totalCount = await prisma.inboundShipment.count();
    console.log(`📦 Total inbound shipments: ${totalCount}`);
    
    if (totalCount > 0) {
      // Get shipments by brand
      const shipmentsByBrand = await prisma.inboundShipment.groupBy({
        by: ['brandId'],
        _count: { id: true },
        _sum: { totalItems: true }
      });
      
      // Get brand names for the IDs
      const brandIds = shipmentsByBrand.map(s => s.brandId);
      const brands = await prisma.brand.findMany({
        where: { id: { in: brandIds } },
        select: { id: true, name: true }
      });
      
      console.log('\n🏢 Shipments by Brand:');
      shipmentsByBrand.forEach(group => {
        const brand = brands.find(b => b.id === group.brandId);
        console.log(`  ${brand?.name || 'Unknown'}: ${group._count.id} shipments (${group._sum.totalItems || 0} total items)`);
      });
      
      // Get recent shipments with details
      const recentShipments = await prisma.inboundShipment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          brand: { select: { name: true } },
          warehouse: { select: { name: true } },
          _count: { select: { items: true } }
        }
      });
      
      console.log('\n📋 Recent Inbound Shipments:');
      recentShipments.forEach((ship, i) => {
        console.log(`  ${i + 1}. ${ship.brand?.name || 'Unknown Brand'}`);
        console.log(`     Status: ${ship.status}`);
        console.log(`     Tracking: ${ship.trackingNumber || 'N/A'}`);
        console.log(`     Expected: ${ship.expectedDate ? new Date(ship.expectedDate).toLocaleDateString() : 'N/A'}`);
        console.log(`     Warehouse: ${ship.warehouse?.name || 'N/A'}`);
        console.log(`     Items: ${ship._count.items}`);
        console.log('');
      });
      
      // Get status breakdown
      const statusBreakdown = await prisma.inboundShipment.groupBy({
        by: ['status'],
        _count: { id: true }
      });
      
      console.log('📈 Status Breakdown:');
      statusBreakdown.forEach(group => {
        console.log(`  ${group.status}: ${group._count.id} shipments`);
      });
      
      // Check line items
      const totalItems = await prisma.inboundShipmentItem.count();
      console.log(`\n📦 Total line items: ${totalItems}`);
      
      if (totalItems > 0) {
        const sampleItems = await prisma.inboundShipmentItem.findMany({
          take: 3,
          include: {
            inboundShipment: {
              include: {
                brand: { select: { name: true } }
              }
            }
          }
        });
        
        console.log('\n🛍️ Sample Line Items:');
        sampleItems.forEach((item, i) => {
          console.log(`  ${i + 1}. SKU: ${item.sku}`);
          console.log(`     Product: ${item.productName || 'N/A'}`);
          console.log(`     Expected: ${item.expectedQuantity}, Received: ${item.receivedQuantity}`);
          console.log(`     Brand: ${item.inboundShipment.brand?.name || 'Unknown'}`);
          console.log('');
        });
      }
    } else {
      console.log('\n💡 No inbound shipments found in the database yet.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
