/**
 * Comprehensive Warehouse Sync Debug Script
 * Fetches ALL ShipHero orders going back 120 days to capture missing unfulfilled orders
 */

const https = require('https');

async function makeShipHeroGraphQLRequest(query, variables, credentials) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      query: query,
      variables: variables
    });

    const options = {
      hostname: 'public-api.shiphero.com',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`));
          } else {
            resolve(response.data);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fetchOrdersInBatches() {
  console.log('🔄 Starting comprehensive ShipHero order fetch (120 days)...');
  
  const credentials = {
    username: 'gavin+mabe@boxioship.com',
    password: 'RJEjVPLOzTsOFnuHsIAy3I5B'
  };

  // Calculate 120-day range to capture all historical unfulfilled orders
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 120);

  console.log(`📅 Fetching range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

  const query = `
    query getOrders($orderDateFrom: ISODateTime!, $orderDateTo: ISODateTime!, $after: String) {
      orders {
        request_id
        complexity
        data(first: 100, after: $after, order_date_from: $orderDateFrom, order_date_to: $orderDateTo) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          edges {
            node {
              id
              order_number
              order_date
              total_price
              fulfillment_status
              profile {
                name
              }
              email
              shipping_address
              line_items(first: 50) {
                edges {
                  node {
                    id
                    sku
                    title
                    quantity
                    quantity_allocated
                    quantity_shipped
                    backorder_quantity
                    price
                    fulfillment_status
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  let allOrders = [];
  let cursor = null;
  let pageCount = 0;
  let totalComplexity = 0;

  console.log('📦 Starting paginated fetch...');

  do {
    pageCount++;
    console.log(`📄 Fetching page ${pageCount}${cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ''}`);

    try {
      const data = await makeShipHeroGraphQLRequest(query, {
        orderDateFrom: startDate.toISOString(),
        orderDateTo: endDate.toISOString(),
        after: cursor
      }, credentials);

      const complexity = data.orders?.complexity || 0;
      totalComplexity += complexity;
      console.log(`✅ Page ${pageCount} response received, complexity: ${complexity} (total: ${totalComplexity})`);

      if (!data.orders?.data?.edges) {
        console.log(`⚠️ No orders data in response for page ${pageCount}`);
        break;
      }

      const pageOrders = data.orders.data.edges.map(edge => edge.node);
      allOrders.push(...pageOrders);

      console.log(`📊 Page ${pageCount}: ${pageOrders.length} orders (Total: ${allOrders.length})`);

      // Check pagination
      const hasNextPage = data.orders.data.pageInfo?.hasNextPage;
      cursor = hasNextPage ? data.orders.data.pageInfo?.endCursor : null;

      if (!hasNextPage) {
        console.log(`✅ All pages fetched. Total orders: ${allOrders.length}`);
        break;
      }

      // Rate limiting - wait between requests
      if (pageCount % 5 === 0) {
        console.log('⏳ Rate limiting pause (5 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

    } catch (error) {
      console.error(`❌ Page ${pageCount} failed:`, error.message);
      break;
    }

  } while (cursor && pageCount < 50); // Safety limit

  // Analyze the results
  console.log('\n📊 COMPREHENSIVE ANALYSIS:');
  console.log(`   - Total orders fetched: ${allOrders.length}`);
  console.log(`   - Total API complexity used: ${totalComplexity}`);
  console.log(`   - Pages fetched: ${pageCount}`);

  // Analyze order statuses
  const statusCounts = {};
  const dateRanges = {};
  
  allOrders.forEach(order => {
    const status = order.fulfillment_status;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    
    const orderDate = new Date(order.order_date);
    const monthYear = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
    if (!dateRanges[monthYear]) dateRanges[monthYear] = { total: 0, unfulfilled: 0 };
    dateRanges[monthYear].total++;
    if (['pending', 'unfulfilled', 'processing'].includes(status)) {
      dateRanges[monthYear].unfulfilled++;
    }
  });

  console.log('\n📈 STATUS BREAKDOWN:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count}`);
  });

  console.log('\n📅 MONTHLY BREAKDOWN:');
  Object.entries(dateRanges).forEach(([month, data]) => {
    console.log(`   - ${month}: ${data.total} total, ${data.unfulfilled} unfulfilled`);
  });

  const totalUnfulfilled = Object.entries(statusCounts)
    .filter(([status]) => ['pending', 'unfulfilled', 'processing'].includes(status))
    .reduce((sum, [, count]) => sum + count, 0);

  console.log(`\n🎯 KEY FINDINGS:`);
  console.log(`   - Total unfulfilled orders in ShipHero: ${totalUnfulfilled}`);
  console.log(`   - Current database unfulfilled: 568`);
  console.log(`   - Missing unfulfilled orders: ${totalUnfulfilled - 568}`);
  
  return allOrders;
}

// Run the comprehensive fetch
fetchOrdersInBatches().catch(console.error);