/**
 * Manual July sync using CommonJS for compatibility
 */

const https = require('https');

class ManualJulySync {
  constructor() {
    this.credentials = {
      username: 'gavin+mabe@boxioship.com',
      password: 'packr2024!'
    };
  }

  async getAccessToken() {
    const tokenData = {
      username: this.credentials.username,
      password: this.credentials.password
    };

    const options = {
      hostname: 'public-api.shiphero.com',
      path: '/auth',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            console.log('🔐 Token response status:', res.statusCode);
            const response = JSON.parse(data);
            if (response.access_token) {
              console.log('✅ Got ShipHero access token');
              resolve(response.access_token);
            } else {
              console.error('❌ No access token in response:', data);
              reject(new Error('No access token in response'));
            }
          } catch (error) {
            console.error('❌ Token parse error:', error, 'Raw data:', data);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Token request error:', error);
        reject(error);
      });

      req.write(JSON.stringify(tokenData));
      req.end();
    });
  }

  async fetchJulyOrders() {
    console.log('🔍 Manually fetching July 2025 orders with ShipHero API...');

    try {
      const token = await this.getAccessToken();
      
      const query = `
        query getOrders($orderDateFrom: ISODateTime, $orderDateTo: ISODateTime, $after: String) {
          orders(order_date_from: $orderDateFrom, order_date_to: $orderDateTo) {
            request_id
            complexity
            data(first: 100, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  legacy_id
                  order_number
                  shop_name
                  fulfillment_status
                  order_date
                  total_price
                  subtotal
                  total_tax
                  email
                  shipping_address {
                    first_name
                    last_name
                    address1
                    city
                    state
                    zip
                    country
                  }
                }
              }
            }
          }
        }
      `;

      const variables = {
        orderDateFrom: '2025-07-01T00:00:00.000Z',
        orderDateTo: '2025-07-31T23:59:59.999Z',
        after: null
      };

      const options = {
        hostname: 'public-api.shiphero.com',
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      };

      let allOrders = [];
      let hasNextPage = true;
      let pageCount = 0;

      console.log(`📅 Fetching orders from ${variables.orderDateFrom} to ${variables.orderDateTo}`);

      while (hasNextPage && pageCount < 200) {
        pageCount++;
        console.log(`📄 Fetching July orders page ${pageCount}${variables.after ? ` (cursor: ${variables.after.substring(0, 20)}...)` : ''}...`);

        const response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              try {
                console.log(`📊 Page ${pageCount} response status:`, res.statusCode);
                resolve(JSON.parse(data));
              } catch (error) {
                console.error(`❌ Page ${pageCount} parse error:`, error);
                reject(error);
              }
            });
          });

          req.on('error', (error) => {
            console.error(`❌ Page ${pageCount} request error:`, error);
            reject(error);
          });

          req.write(JSON.stringify({ query, variables }));
          req.end();
        });

        if (response.errors) {
          console.error('❌ GraphQL errors:', JSON.stringify(response.errors, null, 2));
          
          // Handle rate limiting
          const rateLimitError = response.errors.find(e => e.code === 30);
          if (rateLimitError?.time_remaining) {
            const waitTime = parseInt(rateLimitError.time_remaining.match(/\d+/)[0]) + 2;
            console.log(`⏳ Rate limited. Waiting ${waitTime} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            continue;
          } else {
            console.error('❌ Non-rate-limit errors, stopping');
            break;
          }
        }

        if (!response.data?.orders?.data?.edges) {
          console.error('❌ Invalid response structure:', JSON.stringify(response, null, 2));
          break;
        }

        const orders = response.data.orders.data.edges.map(edge => edge.node);
        allOrders.push(...orders);

        console.log(`📦 Page ${pageCount}: Found ${orders.length} orders (Total: ${allOrders.length})`);
        console.log(`📊 Complexity used: ${response.data.orders.complexity}`);

        hasNextPage = response.data.orders.data.pageInfo.hasNextPage;
        variables.after = response.data.orders.data.pageInfo.endCursor;

        // Brief delay to be API-friendly
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Analyze the data
      const shippedOrders = allOrders.filter(order => order.fulfillment_status === 'fulfilled');
      const statusBreakdown = {};
      
      allOrders.forEach(order => {
        const status = order.fulfillment_status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });
      
      console.log('\n📊 JULY 2025 COMPREHENSIVE ANALYSIS:');
      console.log(`Total July orders found: ${allOrders.length}`);
      console.log(`Fulfilled (shipped) orders: ${shippedOrders.length}`);
      console.log(`Expected from ShipHero report: 14,710`);
      console.log(`Gap: ${14710 - shippedOrders.length}`);
      console.log(`Pages fetched: ${pageCount}`);

      console.log('\n📋 Fulfillment Status Breakdown:');
      Object.entries(statusBreakdown).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });

      // Sample data
      if (shippedOrders.length > 0) {
        console.log('\n📋 Sample fulfilled orders:');
        shippedOrders.slice(0, 5).forEach(order => {
          console.log(`  ${order.order_number} - ${order.order_date} - $${order.total_price}`);
        });
      }

      return {
        totalOrders: allOrders.length,
        shippedOrders: shippedOrders.length,
        statusBreakdown,
        orders: allOrders
      };

    } catch (error) {
      console.error('❌ Manual July sync failed:', error);
      throw error;
    }
  }
}

// Run the sync
const sync = new ManualJulySync();
sync.fetchJulyOrders().then(results => {
  console.log('\n🎯 MANUAL JULY SYNC RESULTS:');
  console.log(`Found ${results.totalOrders} total July orders`);
  console.log(`Found ${results.shippedOrders} shipped orders`);
  
  if (results.shippedOrders > 10000) {
    console.log('✅ SUCCESS: Found large number of shipped orders - close to ShipHero report');
  } else if (results.shippedOrders > 5000) {
    console.log('⚠️ PARTIAL: Found substantial shipped orders but may need more pages');
  } else {
    console.log('❌ WARNING: Found fewer shipped orders than expected from report');
  }
  
  console.log('\n🔍 NEXT STEPS:');
  if (results.shippedOrders < 14710) {
    console.log('- May need to increase pagination limit (currently 200 pages)');
    console.log('- Check if ShipHero report includes different date range');
    console.log('- Verify fulfillment_status mapping is correct');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Manual sync failed:', error);
  process.exit(1);
});