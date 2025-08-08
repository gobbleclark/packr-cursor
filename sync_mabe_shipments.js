/**
 * Sync Mabē shipments from ShipHero to get accurate shipped order counts
 * This will fetch shipment data for the last 30 days
 */

import { shipHeroApiFixed } from './server/services/shipHeroApiFixed.js';
import { storage } from './server/storage.js';

async function syncMabeShipments() {
  console.log('🚢 Starting Mabē shipments sync for last 30 days...');
  
  try {
    const mabeId = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
    const brand = await storage.getBrand(mabeId);
    
    if (!brand) {
      console.error('❌ Mabē brand not found');
      return;
    }
    
    const credentials = {
      username: brand.shipHeroApiKey,
      password: brand.shipHeroPassword
    };
    
    // Get shipments from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    console.log(`📅 Fetching shipments from: ${thirtyDaysAgo.toISOString()}`);
    
    // Use the fixed API to get shipments
    const shipments = await shipHeroApiFixed.getShipments(credentials, thirtyDaysAgo, new Date());
    
    console.log(`📦 Found ${shipments.length} shipments from ShipHero`);
    
    let shipmentsProcessed = 0;
    
    for (const shipment of shipments) {
      try {
        // Check if shipment already exists
        const existingShipment = await storage.getShipmentByShipHeroId?.(shipment.id);
        
        if (!existingShipment) {
          // Create new shipment record
          const shipmentData = {
            orderId: null, // Will need to match with order
            brandId: mabeId,
            shipHeroShipmentId: shipment.id,
            trackingNumber: shipment.tracking_number,
            carrier: shipment.carrier,
            service: shipment.service || 'Standard',
            status: shipment.status || 'shipped',
            shippedAt: new Date(shipment.shipped_date || shipment.created_at),
            estimatedDelivery: shipment.expected_delivery_date ? new Date(shipment.expected_delivery_date) : null,
            actualDelivery: shipment.delivered_at ? new Date(shipment.delivered_at) : null
          };
          
          // Try to match with existing order
          if (shipment.order_number) {
            const order = await storage.getOrderByNumber?.(shipment.order_number);
            if (order) {
              shipmentData.orderId = order.id;
            }
          }
          
          await storage.createShipment?.(shipmentData);
          shipmentsProcessed++;
        }
        
      } catch (error) {
        console.error(`❌ Failed to process shipment ${shipment.id}:`, error);
      }
    }
    
    console.log(`✅ Processed ${shipmentsProcessed} new shipments`);
    console.log(`📊 Total shipments found: ${shipments.length}`);
    
    // Get final count from database
    const finalCount = await storage.getShipmentCountByBrand?.(mabeId, thirtyDaysAgo) || 0;
    console.log(`🎯 Final database shipment count for last 30 days: ${finalCount}`);
    
  } catch (error) {
    console.error('❌ Shipments sync failed:', error);
  }
}

syncMabeShipments().then(() => {
  console.log('✅ Shipments sync completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Sync failed:', error);
  process.exit(1);
});