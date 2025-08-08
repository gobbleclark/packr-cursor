/**
 * Emergency: Directly sync Mabe July orders using SQL and fetch
 * This is a targeted approach to immediately resolve the July data gap
 */

const fetch = require('node-fetch');
const { Client } = require('pg');

class DirectJulySync {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.brandId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    this.dbClient = new Client({
      connectionString: process.env.DATABASE_URL
    });
  }

  async checkCurrentState() {
    console.log('📊 Checking current database state...');
    
    try {
      await this.dbClient.connect();
      
      const result = await this.dbClient.query(`
        SELECT 
          DATE_TRUNC('month', order_date) as month,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN fulfillment_status = 'fulfilled' THEN 1 END) as shipped
        FROM orders 
        WHERE brand_id = $1 AND order_date >= '2025-04-01'
        GROUP BY DATE_TRUNC('month', order_date)
        ORDER BY month
      `, [this.brandId]);
      
      console.log('📈 Current monthly breakdown:');
      result.rows.forEach(row => {
        const month = new Date(row.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        console.log(`   ${month}: ${row.total_orders} total, ${row.shipped} shipped`);
      });
      
      const julyData = result.rows.find(row => 
        new Date(row.month).getMonth() === 6 // July is month 6 (0-indexed)
      );
      
      return {
        hasJulyData: !!julyData,
        julyOrders: julyData?.total_orders || 0,
        julyShipped: julyData?.shipped || 0
      };
      
    } finally {
      await this.dbClient.end();
    }
  }

  async triggerShipmentSync() {
    console.log('🚢 Triggering shipment sync specifically for July 2025...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/shiphero/sync/${this.brandId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'shipments',
          days: 180 // Go back 180 days to capture July
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Shipment sync triggered:', result);
        return true;
      } else {
        const error = await response.text();
        console.log('❌ Shipment sync failed:', error);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Shipment sync error:', error);
      return false;
    }
  }

  async triggerManualSync() {
    console.log('🔄 Triggering manual full sync...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/shiphero/sync/${this.brandId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'full'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Manual sync triggered:', result);
        return true;
      } else {
        const error = await response.text();
        console.log('❌ Manual sync failed:', error);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Manual sync error:', error);
      return false;
    }
  }

  async monitorProgress(initialState, duration = 60000) {
    console.log(`📊 Monitoring progress for ${duration/1000} seconds...`);
    
    const startTime = Date.now();
    let lastCount = initialState.julyOrders;
    
    while (Date.now() - startTime < duration) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      try {
        const currentState = await this.checkCurrentState();
        
        if (currentState.julyOrders > lastCount) {
          const increase = currentState.julyOrders - lastCount;
          console.log(`📈 Progress: +${increase} July orders (Total: ${currentState.julyOrders}, Shipped: ${currentState.julyShipped})`);
          lastCount = currentState.julyOrders;
          
          if (currentState.julyShipped > 10000) {
            console.log('🎯 SUCCESS: Substantial July shipped orders captured!');
            return currentState;
          }
        } else {
          console.log(`⏳ Waiting... (July orders: ${currentState.julyOrders}, July shipped: ${currentState.julyShipped})`);
        }
        
      } catch (error) {
        console.error('❌ Progress check failed:', error);
      }
    }
    
    return await this.checkCurrentState();
  }

  async performDirectSync() {
    console.log('🚨 DIRECT MABE JULY SYNC');
    console.log('🎯 Target: Capture 14,710 shipped orders from July 2025');
    
    try {
      // 1. Check initial state
      const initialState = await this.checkCurrentState();
      console.log(`\n📊 Initial state: ${initialState.julyOrders} July orders, ${initialState.julyShipped} shipped`);
      
      if (initialState.julyOrders === 0) {
        console.log('🚨 CONFIRMED: Zero July orders - triggering emergency sync');
        
        // 2. Try shipment sync first (should capture July data)
        console.log('\n🚢 Step 1: Triggering shipment sync for 180 days...');
        await this.triggerShipmentSync();
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
        
        // 3. Try manual full sync
        console.log('\n🔄 Step 2: Triggering manual full sync...');
        await this.triggerManualSync();
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
        
        // 4. Monitor progress
        console.log('\n📊 Step 3: Monitoring progress...');
        const finalState = await this.monitorProgress(initialState, 120000); // Monitor for 2 minutes
        
        console.log('\n🎯 FINAL RESULTS:');
        console.log(`July orders: ${finalState.julyOrders} (was ${initialState.julyOrders})`);
        console.log(`July shipped: ${finalState.julyShipped} (was ${initialState.julyShipped})`);
        console.log(`Target: 14,710 shipped`);
        console.log(`Gap: ${14710 - finalState.julyShipped}`);
        
        if (finalState.julyShipped > 10000) {
          console.log('✅ MAJOR SUCCESS: Substantial July data captured!');
        } else if (finalState.julyOrders > 1000) {
          console.log('✅ PROGRESS: Some July data captured, may need fulfillment status review');
        } else {
          console.log('❌ CRITICAL: System still not capturing July data - deeper fix needed');
        }
        
        return finalState;
        
      } else {
        console.log(`✅ July data already exists: ${initialState.julyOrders} orders`);
        return initialState;
      }
      
    } catch (error) {
      console.error('❌ Direct sync failed:', error);
      throw error;
    }
  }
}

// Execute the direct sync
const directSync = new DirectJulySync();
directSync.performDirectSync()
  .then(results => {
    console.log('\n🎯 DIRECT JULY SYNC COMPLETE');
    console.log(`Final July orders: ${results.julyOrders}`);
    console.log(`Final July shipped: ${results.julyShipped}`);
    
    if (results.julyShipped > 5000) {
      console.log('✅ SUCCESS: Substantial progress toward 14,710 target');
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Direct sync process failed:', error);
    process.exit(1);
  });