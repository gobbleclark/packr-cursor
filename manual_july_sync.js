/**
 * Manual July sync using direct ShipHero API calls
 * This will specifically target July 2025 orders
 */

const https = require('https');

class ManualJulySync {
  constructor() {
    this.baseUrl = 'https://public-api.shiphero.com';
    this.credentials = {
      username: 'gavin+mabe@boxioship.com',
      password: process.env.MABE_SHIPHERO_PASSWORD || 'packr2024!'
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
            const response = JSON.parse(data);
            if (response.access_token) {
              console.log('✅ Got ShipHero access token');
              resolve(response.access_token);
            } else {
              reject(new Error('No access token in response'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(tokenData));
      req.end();
    });
  }

  async fetchJulyOrders() {
    console.log('🔍 Manually fetching July 2025 orders...');

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

      while (hasNextPage && pageCount < 200) {
        pageCount++;
        console.log(`📄 Fetching July orders page ${pageCount}...`);

        const response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (error) {
                reject(error);
              }
            });
          });

          req.on('error', reject);
          req.write(JSON.stringify({ query, variables }));
          req.end();
        });

        if (response.errors) {
          console.error('❌ GraphQL errors:', response.errors);
          if (response.errors[0]?.time_remaining) {
            const waitTime = parseInt(response.errors[0].time_remaining.match(/\d+/)[0]) + 2;
            console.log(`⏳ Waiting ${waitTime} seconds for credits...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            continue;
          } else {
            break;
          }
        }

        if (!response.data?.orders?.data?.edges) {
          console.error('❌ Invalid response structure');
          break;
        }

        const orders = response.data.orders.data.edges.map(edge => edge.node);
        allOrders.push(...orders);

        console.log(`📦 Page ${pageCount}: Found ${orders.length} orders (Total: ${allOrders.length})`);

        hasNextPage = response.data.orders.data.pageInfo.hasNextPage;
        variables.after = response.data.orders.data.pageInfo.endCursor;

        // Short delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Analyze the data
      const shippedOrders = allOrders.filter(order => order.fulfillment_status === 'fulfilled');
      
      console.log('\n📊 JULY 2025 ANALYSIS:');
      console.log(`Total July orders found: ${allOrders.length}`);
      console.log(`Fulfilled (shipped) orders: ${shippedOrders.length}`);
      console.log(`Expected from ShipHero report: 14,710`);
      console.log(`Gap: ${14710 - shippedOrders.length}`);

      // Sample data
      if (shippedOrders.length > 0) {
        console.log('\n📋 Sample fulfilled orders:');
        shippedOrders.slice(0, 10).forEach(order => {
          console.log(`  ${order.order_number} - ${order.order_date} - $${order.total_price}`);
        });
      }

      return {
        totalOrders: allOrders.length,
        shippedOrders: shippedOrders.length,
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
  console.log('\n🎯 MANUAL JULY SYNC COMPLETE');
  console.log(`Found ${results.totalOrders} total orders`);
  console.log(`Found ${results.shippedOrders} shipped orders`);
  
  if (results.shippedOrders > 10000) {
    console.log('✅ SUCCESS: Found large number of shipped orders matching expectations');
  } else {
    console.log('⚠️ WARNING: Found fewer shipped orders than expected');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Manual sync failed:', error);
  process.exit(1);
});