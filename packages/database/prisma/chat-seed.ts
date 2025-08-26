import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedChatData() {
  console.log('🌱 Seeding chat data...');

  try {
    // Get existing data
    const threepl = await prisma.threePL.findFirst({ where: { slug: 'demo-3pl' } });
    const brand = await prisma.brand.findFirst({ where: { slug: 'demo-brand' } });
    const threeplUser = await prisma.user.findFirst({ where: { email: '3pl@demo.com' } });
    const brandUser = await prisma.user.findFirst({ where: { email: 'brand@demo.com' } });

    if (!threepl || !brand || !threeplUser || !brandUser) {
      console.log('❌ Please run the main seed first to create users and brands');
      return;
    }

    // Create chat room
    const chatRoom = await prisma.chatRoom.upsert({
      where: {
        threeplId_brandId: { threeplId: threepl.id, brandId: brand.id }
      },
      update: {},
      create: {
        threeplId: threepl.id,
        brandId: brand.id
      }
    });

    console.log(`✅ Created chat room: ${chatRoom.id}`);

    // Create sample messages
    const messages = [
      {
        content: "Hi! Welcome to our chat system. How can we help you today?",
        userId: threeplUser.id,
        messageType: 'TEXT' as const
      },
      {
        content: "Hello! I have a question about my recent order shipment.",
        userId: brandUser.id,
        messageType: 'TEXT' as const
      },
      {
        content: "Of course! I'd be happy to help. Which order are you referring to?",
        userId: threeplUser.id,
        messageType: 'TEXT' as const
      },
      {
        content: "It's order #ORD-0001. The tracking shows it's been sitting for 3 days.",
        userId: brandUser.id,
        messageType: 'TEXT' as const
      },
      {
        content: "Let me check on that for you right away. I'll create a task to investigate.",
        userId: threeplUser.id,
        messageType: 'TEXT' as const
      }
    ];

    const createdMessages = [];
    for (const messageData of messages) {
      const message = await prisma.chatMessage.create({
        data: {
          roomId: chatRoom.id,
          content: messageData.content,
          userId: messageData.userId,
          messageType: messageData.messageType
        }
      });
      createdMessages.push(message);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Created ${createdMessages.length} sample messages`);

    // Create sample tasks
    const tasks = [
      {
        title: "Investigate Order #ORD-0001 Shipping Delay",
        description: "Customer reports tracking shows order sitting for 3 days. Need to check with carrier and provide update.",
        status: 'TODO' as const,
        priority: 'HIGH' as const,
        assigneeId: threeplUser.id,
        createdById: threeplUser.id,
        createdFromMessageId: createdMessages[createdMessages.length - 1].id
      },
      {
        title: "Update inventory counts for Brand ABC",
        description: "Weekly inventory reconciliation needed",
        status: 'IN_PROGRESS' as const,
        priority: 'NORMAL' as const,
        assigneeId: threeplUser.id,
        createdById: threeplUser.id
      },
      {
        title: "Process return batch #RET-001",
        description: "Process returned items and update inventory",
        status: 'COMPLETED' as const,
        priority: 'NORMAL' as const,
        assigneeId: threeplUser.id,
        createdById: threeplUser.id,
        completedAt: new Date()
      }
    ];

    const createdTasks = [];
    for (const taskData of tasks) {
      const task = await prisma.chatTask.create({
        data: {
          roomId: chatRoom.id,
          ...taskData
        }
      });
      createdTasks.push(task);
    }

    console.log(`✅ Created ${createdTasks.length} sample tasks`);

    // Create task comments
    await prisma.taskComment.create({
      data: {
        taskId: createdTasks[0].id,
        userId: threeplUser.id,
        content: "I've contacted the carrier and they confirmed there was a delay at their facility. The package should be moving again within 24 hours."
      }
    });

    await prisma.taskComment.create({
      data: {
        taskId: createdTasks[0].id,
        userId: brandUser.id,
        content: "Thank you for the quick response! Please keep me updated."
      }
    });

    console.log(`✅ Created sample task comments`);

    // Create read receipts (mark some messages as read)
    for (let i = 0; i < createdMessages.length - 1; i++) {
      const message = createdMessages[i];
      // Mark messages as read by the other user
      const readerId = message.userId === threeplUser.id ? brandUser.id : threeplUser.id;
      
      await prisma.readReceipt.create({
        data: {
          roomId: chatRoom.id,
          messageId: message.id,
          userId: readerId
        }
      });
    }

    console.log(`✅ Created read receipts`);

    console.log('🎉 Chat data seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding chat data:', error);
    throw error;
  }
}

seedChatData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

