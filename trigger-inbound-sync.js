const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function triggerInboundSync() {
  try {
    console.log('🚀 Triggering inbound shipments sync...\n');
    
    // Get a user with THREEPL_ADMIN role to generate a token
    const adminUser = await prisma.user.findFirst({
      where: {
        memberships: {
          some: {
            role: 'THREEPL_ADMIN'
          }
        }
      },
      include: {
        memberships: {
          include: {
            threepl: true,
            brand: true
          }
        }
      }
    });

    if (!adminUser) {
      console.error('❌ No THREEPL_ADMIN user found');
      return;
    }

    console.log(`👤 Using admin user: ${adminUser.email}`);

    // Create a temporary auth token (this simulates the login process)
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    const membership = adminUser.memberships.find(m => m.role === 'THREEPL_ADMIN');
    const token = jwt.sign({
      userId: adminUser.id,
      email: adminUser.email,
      role: membership.role,
      threeplId: membership.threeplId,
      brandId: membership.brandId
    }, JWT_SECRET, { expiresIn: '1h' });

    console.log('🔑 Generated auth token\n');

    // Brand IDs
    const brands = [
      { name: 'Clean Monday Meals', id: 'cmensk9iu03a613vw6ymd1xzn' },
      { name: 'Mabe', id: 'cmelv3utw0002jb3yhtrxscnq' }
    ];

    // Trigger sync for each brand
    for (const brand of brands) {
      console.log(`🔄 Triggering sync for ${brand.name}...`);
      
      try {
        const response = await axios.post(
          `http://localhost:4000/api/brands/${brand.id}/integrations/trackstar/sync`,
          {
            functions: ['get_inbound_shipments']
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.success) {
          console.log(`✅ ${brand.name}: Sync triggered successfully`);
        } else {
          console.log(`❌ ${brand.name}: Sync failed - ${response.data.message}`);
        }
      } catch (error) {
        console.log(`❌ ${brand.name}: Error - ${error.response?.data?.message || error.message}`);
      }
    }

    console.log('\n⏳ Waiting 10 seconds for sync to process...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check results
    const inboundCount = await prisma.inboundShipment.count();
    console.log(`\n📦 Inbound shipments after sync: ${inboundCount}`);

    if (inboundCount > 0) {
      const shipments = await prisma.inboundShipment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          brand: { select: { name: true } },
          _count: { select: { items: true } }
        }
      });

      console.log('\n📋 Recent inbound shipments:');
      shipments.forEach(ship => {
        console.log(`  ${ship.brand?.name}: ${ship.trackingNumber || ship.id.slice(0, 8)} - ${ship.status} (${ship._count.items} items)`);
      });
    } else {
      console.log('\n💡 No inbound shipments found. This could mean:');
      console.log('   - These brands don\'t have any inbound shipments in Trackstar');
      console.log('   - The Trackstar API endpoint returned empty results');
      console.log('   - There was an error during sync (check API logs)');
    }

    // Check job runs
    const jobCount = await prisma.jobRun.count();
    if (jobCount > 0) {
      const recentJobs = await prisma.jobRun.findMany({
        take: 3,
        orderBy: { startedAt: 'desc' }
      });
      
      console.log('\n🔄 Recent job runs:');
      recentJobs.forEach(job => {
        console.log(`  ${job.jobType} - ${job.status} - ${new Date(job.startedAt).toLocaleTimeString()}`);
        if (job.error) {
          console.log(`    Error: ${job.error.slice(0, 100)}...`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

triggerInboundSync();
