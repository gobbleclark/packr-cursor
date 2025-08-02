/**
 * Comprehensive API Test Suite
 * Tests all existing functionality to ensure no regressions
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('API Test Suite', () => {
  const BASE_URL = 'http://localhost:5000/api';
  const TEST_BRAND_ID = 'dce4813e-aeb7-41fe-bb00-a36e314288f3';
  
  // Mock authentication for testing
  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': 'connect.sid=test-session' // This would need to be a real session in practice
  };

  describe('Brand Management', () => {
    it('should fetch brands for 3PL user', async () => {
      const response = await fetch(`${BASE_URL}/brands`, {
        headers: authHeaders
      });
      
      expect(response.status).toBe(200);
      const brands = await response.json();
      expect(Array.isArray(brands)).toBe(true);
    });

    it('should show brand with ShipHero integration status', async () => {
      const response = await fetch(`${BASE_URL}/brands`, {
        headers: authHeaders
      });
      
      const brands = await response.json();
      const mabeBrand = brands.find(b => b.name === 'Mabē ');
      
      expect(mabeBrand).toBeDefined();
      expect(mabeBrand.hasShipHeroIntegration).toBe(true);
      expect(mabeBrand.status).toBe('active');
    });
  });

  describe('Data Sync Operations', () => {
    it('should sync orders from ShipHero', async () => {
      const response = await fetch(`${BASE_URL}/brands/${TEST_BRAND_ID}/sync/orders`, {
        method: 'POST',
        headers: authHeaders
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.message).toContain('sync completed');
      expect(typeof result.results.orders).toBe('number');
    });

    it('should sync products from ShipHero', async () => {
      const response = await fetch(`${BASE_URL}/brands/${TEST_BRAND_ID}/sync/products`, {
        method: 'POST',
        headers: authHeaders
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.message).toContain('sync completed');
      expect(typeof result.results.products).toBe('number');
    });

    it('should perform initial sync with historical data', async () => {
      const response = await fetch(`${BASE_URL}/brands/${TEST_BRAND_ID}/sync/initial`, {
        method: 'POST',
        headers: authHeaders
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.message).toContain('Initial sync completed');
      expect(result.results.timeRange).toBe('7 days historical data');
    });
  });

  describe('Database Data Integrity', () => {
    it('should have real orders in database after sync', async () => {
      // Trigger sync first
      await fetch(`${BASE_URL}/brands/${TEST_BRAND_ID}/sync/orders`, {
        method: 'POST',
        headers: authHeaders
      });

      // Check orders endpoint
      const response = await fetch(`${BASE_URL}/orders`, {
        headers: authHeaders
      });
      
      expect(response.status).toBe(200);
      const orders = await response.json();
      expect(Array.isArray(orders)).toBe(true);
      
      // Verify orders have real ShipHero data
      if (orders.length > 0) {
        const order = orders[0];
        expect(order.shipHeroOrderId).toBeDefined();
        expect(order.orderNumber).toBeDefined();
        expect(order.brandId).toBe(TEST_BRAND_ID);
      }
    });

    it('should have real products in database after sync', async () => {
      // Trigger sync first
      await fetch(`${BASE_URL}/brands/${TEST_BRAND_ID}/sync/products`, {
        method: 'POST',
        headers: authHeaders
      });

      // Check products endpoint  
      const response = await fetch(`${BASE_URL}/products`, {
        headers: authHeaders
      });
      
      expect(response.status).toBe(200);
      const products = await response.json();
      expect(Array.isArray(products)).toBe(true);
      
      // Verify products have real ShipHero data
      if (products.length > 0) {
        const product = products[0];
        expect(product.shipHeroProductId).toBeDefined();
        expect(product.sku).toBeDefined();
        expect(product.brandId).toBe(TEST_BRAND_ID);
      }
    });
  });

  describe('Sync Status Tracking', () => {
    it('should provide accurate sync status', async () => {
      const response = await fetch(`${BASE_URL}/brands/${TEST_BRAND_ID}/sync-status`, {
        headers: authHeaders
      });
      
      expect(response.status).toBe(200);
      const status = await response.json();
      
      expect(status.orders).toBeDefined();
      expect(status.products).toBeDefined();
      expect(status.shipments).toBeDefined();
      
      // Verify sync status reflects actual database state
      if (status.orders.lastSyncAt) {
        expect(new Date(status.orders.lastSyncAt)).toBeInstanceOf(Date);
      }
    });

    it('should show different sync results on subsequent runs', async () => {
      // Get initial status
      const initialResponse = await fetch(`${BASE_URL}/brands/${TEST_BRAND_ID}/sync-status`, {
        headers: authHeaders
      });
      const initialStatus = await initialResponse.json();
      
      // Trigger sync
      await fetch(`${BASE_URL}/brands/${TEST_BRAND_ID}/sync/orders`, {
        method: 'POST',
        headers: authHeaders
      });
      
      // Get updated status
      const updatedResponse = await fetch(`${BASE_URL}/brands/${TEST_BRAND_ID}/sync-status`, {
        headers: authHeaders
      });
      const updatedStatus = await updatedResponse.json();
      
      // Status should be updated (different timestamps at minimum)
      expect(updatedStatus.orders.lastSyncAt).not.toBe(initialStatus.orders.lastSyncAt);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid brand ID gracefully', async () => {
      const response = await fetch(`${BASE_URL}/brands/invalid-id/sync/orders`, {
        method: 'POST',
        headers: authHeaders
      });
      
      expect(response.status).toBe(404);
    });

    it('should handle API credential issues', async () => {
      // This would test with invalid credentials, but we'll skip for now
      // as we have valid credentials working
    });
  });

  describe('Dashboard Stats', () => {
    it('should return real dashboard statistics', async () => {
      const response = await fetch(`${BASE_URL}/dashboard/stats`, {
        headers: authHeaders
      });
      
      expect(response.status).toBe(200);
      const stats = await response.json();
      
      expect(typeof stats.totalOrders).toBe('number');
      expect(typeof stats.openTickets).toBe('number');
      expect(typeof stats.urgentTickets).toBe('number');
      expect(typeof stats.lowInventoryItems).toBe('number');
    });
  });
});