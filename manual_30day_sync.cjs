/**
 * Manual 30-day sync targeting July specifically using CommonJS
 * Direct approach to capture missing July 2025 data
 */

const https = require('https');
const { Client } = require('pg');

class ManualJulySync {
  constructor() {
    this.credentials = {
      username: 'gavin+mabe@boxioship.com',
      password: 'packr2024!'
    };
    this.dbClient = new Client({
      connectionString: process.env.DATABASE_URL
    });
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
            if (res.statusCode === 200) {
              const response = JSON.parse(data);
              console.log('✅ Got ShipHero access token');
              resolve(response.access_token);
            } else {
              console.error('❌ Token request failed:', res.statusCode, data);
              reject(new Error(`Token request failed: ${res.statusCode} ${data}`));
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

  async fetchJulyOrdersBatch() {
    console.log('🔍 Fetching July 2025 orders from ShipHero...');

    try {
      const token = await this.getAccessToken();
      
      // GraphQL query targeting July specifically
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
                  profile
                  shipping_address {
                    first_name
                    last_name
                    address1
                    address2
                    city
                    state
                    zip
                    country
                  }
                  line_items(first: 5) {
                    edges {
                      node {
                        sku
                        quantity
                        quantity_shipped
                        product_name
                        price
                      }
                    }
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

      console.log(`📅 Fetching orders for July 1-31, 2025...`);

      while (hasNextPage && pageCount < 500) { // Increased limit for July
        pageCount++;
        console.log(`📄 Fetching July page ${pageCount}${variables.after ? ` (cursor: ${variables.after.substring(0, 15)}...)` : ''}...`);

        const response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              try {
                const parsedResponse = JSON.parse(data);
                resolve(parsedResponse);
              } catch (error) {
                console.error(`❌ Parse error on page ${pageCount}:`, error);
                reject(error);
              }
            });
          });

          req.on('error', (error) => {
            console.error(`❌ Request error on page ${pageCount}:`, error);
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
            const waitTime = parseInt(rateLimitError.time_remaining.match(/\d+/)[0]) + 3;
            console.log(`⏳ Rate limited. Waiting ${waitTime} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            continue;
          } else {
            console.error('❌ Non-rate-limit errors, stopping');
            break;
          }
        }

        if (!response.data?.orders?.data?.edges) {
          console.error('❌ Invalid response structure');
          console.log('Response:', JSON.stringify(response, null, 2));
          break;
        }

        const orders = response.data.orders.data.edges.map(edge => edge.node);
        allOrders.push(...orders);

        console.log(`📦 Page ${pageCount}: Found ${orders.length} orders (Total: ${allOrders.length})`);
        
        // Show progress on shipped vs total
        const pageShipped = orders.filter(o => o.fulfillment_status === 'fulfilled').length;
        const totalShipped = allOrders.filter(o => o.fulfillment_status === 'fulfilled').length;
        console.log(`🚢 Page ${pageCount} shipped: ${pageShipped}, Total shipped so far: ${totalShipped}`);

        hasNextPage = response.data.orders.data.pageInfo.hasNextPage;
        variables.after = response.data.orders.data.pageInfo.endCursor;

        // Brief delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const shippedOrders = allOrders.filter(order => order.fulfillment_status === 'fulfilled');
      
      console.log('\n🎯 JULY 2025 RESULTS:');
      console.log(`Total July orders found: ${allOrders.length}`);
      console.log(`July shipped orders: ${shippedOrders.length}`);
      console.log(`Target from report: 14,710`);
      console.log(`Gap: ${14710 - shippedOrders.length}`);
      console.log(`Pages processed: ${pageCount}`);

      return {
        totalOrders: allOrders.length,
        shippedOrders: shippedOrders.length,
        orders: allOrders
      };

    } catch (error) {
      console.error('❌ July batch fetch failed:', error);
      throw error;
    }
  }

  async insertOrdersToDatabase(orders) {
    console.log('\n💾 Inserting July orders into database...');
    
    try {
      await this.dbClient.connect();
      
      let insertCount = 0;
      const brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';

      for (const order of orders) {
        try {
          // Check if exists
          const existingCheck = await this.dbClient.query(
            'SELECT id FROM orders WHERE order_number = $1',
            [order.order_number]
          );

          if (existingCheck.rows.length === 0) {
            // Insert new order
            const insertQuery = `
              INSERT INTO orders (
                order_number, brand_id, customer_name, customer_email, 
                shipping_address, status, total_amount, ship_hero_order_id,
                ship_hero_legacy_id, shop_name, fulfillment_status, subtotal,
                total_tax, order_date, ship_hero_updated_at, last_sync_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
              RETURNING id
            `;

            const customerName = order.shipping_address ? 
              `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim() : 
              'Unknown';

            const values = [
              order.order_number,
              brandId,
              customerName,
              order.email || '',
              JSON.stringify(order.shipping_address || {}),
              order.fulfillment_status === 'fulfilled' ? 'shipped' : 'pending',
              order.total_price || '0',
              order.id,
              order.legacy_id,
              order.shop_name,
              order.fulfillment_status,
              order.subtotal || '0',
              order.total_tax || '0',
              new Date(order.order_date),
              new Date(),
              new Date()
            ];

            const result = await this.dbClient.query(insertQuery, values);
            insertCount++;

            // Insert line items if available
            if (order.line_items?.edges?.length > 0) {
              const orderId = result.rows[0].id;
              for (const edge of order.line_items.edges) {
                const item = edge.node;
                await this.dbClient.query(`
                  INSERT INTO order_items (
                    order_id, sku, quantity, quantity_shipped, product_name, price
                  ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                  orderId,
                  item.sku,
                  item.quantity,
                  item.quantity_shipped || 0,
                  item.product_name,
                  item.price || '0'
                ]);
              }
            }

            if (insertCount % 100 === 0) {
              console.log(`📦 Processed ${insertCount} orders...`);
            }
          }
        } catch (error) {
          console.error(`Failed to insert order ${order.order_number}:`, error);
        }
      }

      console.log(`✅ Successfully inserted ${insertCount} new July orders`);
      return insertCount;

    } catch (error) {
      console.error('❌ Database insertion failed:', error);
      throw error;
    } finally {
      await this.dbClient.end();
    }
  }

  async performJulySync() {
    console.log('🚨 MANUAL JULY 2025 SYNC STARTING');
    console.log('🎯 Target: Capture 14,710 shipped orders');
    
    try {
      const fetchResults = await this.fetchJulyOrdersBatch();
      
      if (fetchResults.totalOrders === 0) {
        console.log('❌ No July orders found - may be API or date range issue');
        return;
      }

      const insertCount = await this.insertOrdersToDatabase(fetchResults.orders);
      
      console.log('\n🎯 MANUAL JULY SYNC COMPLETE');
      console.log(`Orders found: ${fetchResults.totalOrders}`);
      console.log(`Shipped orders: ${fetchResults.shippedOrders}`);
      console.log(`Orders inserted: ${insertCount}`);
      console.log(`Target: 14,710`);
      console.log(`Gap: ${14710 - fetchResults.shippedOrders}`);

      if (fetchResults.shippedOrders > 10000) {
        console.log('✅ MAJOR SUCCESS: Substantial July data captured!');
      } else if (fetchResults.shippedOrders > 5000) {
        console.log('✅ GOOD PROGRESS: Significant July data captured');
      } else {
        console.log('⚠️ MORE WORK NEEDED: Lower than expected');
      }

    } catch (error) {
      console.error('❌ Manual July sync failed:', error);
      throw error;
    }
  }
}

// Execute the sync
const julySync = new ManualJulySync();
julySync.performJulySync()
  .then(() => {
    console.log('✅ Manual July sync process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Sync process failed:', error);
    process.exit(1);
  });