/**
 * Purchase Order Management Service for ShipHero Integration
 * 
 * Enables brands to create and edit purchase orders as specified in requirements:
 * "Give the brand the ability to create and edit purchase orders. 
 * This is the brand letting the 3PL know what incoming inventory they have 
 * that will arrive to the warehouse for receiving."
 */

import { IStorage } from '../storage';

interface PurchaseOrderLineItem {
  sku: string;
  productName: string;
  quantity: number;
  unitCost?: number;
  expectedDate?: Date;
}

interface CreatePurchaseOrderRequest {
  brandId: string;
  poNumber?: string;
  supplierName: string;
  supplierEmail?: string;
  warehouse?: string;
  expectedDate: Date;
  notes?: string;
  lineItems: PurchaseOrderLineItem[];
}

interface ShipHeroPOData {
  po_number: string;
  supplier_name: string;
  email?: string;
  po_date: string;
  expected_date: string;
  warehouse?: string;
  notes?: string;
  line_items: Array<{
    sku: string;
    product_name: string;
    quantity: number;
    cost?: number;
    expected_date?: string;
  }>;
}

export class PurchaseOrderService {
  constructor(private storage: IStorage) {}

  /**
   * Create a new Purchase Order in both local DB and ShipHero
   */
  async createPurchaseOrder(request: CreatePurchaseOrderRequest): Promise<any> {
    console.log(`📋 Creating purchase order for brand: ${request.brandId}`);
    
    try {
      // Get brand and verify ShipHero credentials
      const brand = await this.storage.getBrand(request.brandId);
      if (!brand) {
        throw new Error('Brand not found');
      }
      
      if (!brand.shipHeroApiKey || !brand.shipHeroPassword) {
        throw new Error('ShipHero credentials not configured for this brand');
      }
      
      // Generate PO number if not provided
      const poNumber = request.poNumber || await this.generatePONumber(request.brandId);
      
      // Create local PO record first
      const localPO = await this.createLocalPurchaseOrder({
        ...request,
        poNumber
      });
      
      // Create in ShipHero
      const shipHeroPOData: ShipHeroPOData = {
        po_number: poNumber,
        supplier_name: request.supplierName,
        email: request.supplierEmail,
        po_date: new Date().toISOString(),
        expected_date: request.expectedDate.toISOString(),
        warehouse: request.warehouse,
        notes: request.notes,
        line_items: request.lineItems.map(item => ({
          sku: item.sku,
          product_name: item.productName,
          quantity: item.quantity,
          cost: item.unitCost,
          expected_date: item.expectedDate?.toISOString()
        }))
      };
      
      const credentials = {
        username: brand.shipHeroApiKey,
        password: brand.shipHeroPassword
      };
      
      const shipHeroResponse = await this.createShipHeroPO(credentials, shipHeroPOData);
      
      // Update local record with ShipHero ID
      await this.storage.updatePurchaseOrder?.(localPO.id, {
        shipHeroPoId: shipHeroResponse.po.id,
        status: 'pending',
        lastSyncAt: new Date()
      });
      
      console.log(`✅ Purchase Order ${poNumber} created successfully`);
      
      return {
        ...localPO,
        shipHeroPoId: shipHeroResponse.po.id,
        status: 'pending'
      };
      
    } catch (error) {
      console.error('❌ Purchase Order creation failed:', error);
      throw error;
    }
  }

  /**
   * Update an existing Purchase Order
   */
  async updatePurchaseOrder(poId: string, updates: Partial<CreatePurchaseOrderRequest>): Promise<any> {
    console.log(`📝 Updating purchase order: ${poId}`);
    
    try {
      const existingPO = await this.storage.getPurchaseOrder?.(poId);
      if (!existingPO) {
        throw new Error('Purchase Order not found');
      }
      
      const brand = await this.storage.getBrand(existingPO.brandId);
      if (!brand?.shipHeroApiKey || !brand?.shipHeroPassword) {
        throw new Error('ShipHero credentials not configured');
      }
      
      // Update local record
      await this.storage.updatePurchaseOrder?.(poId, {
        supplierName: updates.supplierName || existingPO.supplierName,
        supplierEmail: updates.supplierEmail || existingPO.supplierEmail,
        warehouse: updates.warehouse || existingPO.warehouse,
        expectedDate: updates.expectedDate || existingPO.expectedDate,
        notes: updates.notes || existingPO.notes,
        lastSyncAt: new Date()
      });
      
      // Update line items if provided
      if (updates.lineItems) {
        // Delete existing line items and create new ones
        await this.storage.deletePurchaseOrderItems?.(poId);
        
        for (const item of updates.lineItems) {
          await this.storage.createPurchaseOrderItem?.({
            poId,
            sku: item.sku,
            productName: item.productName,
            quantity: item.quantity,
            unitCost: item.unitCost,
            expectedDate: item.expectedDate
          });
        }
      }
      
      // Update in ShipHero if it has a ShipHero ID
      if (existingPO.shipHeroPoId) {
        const credentials = {
          username: brand.shipHeroApiKey,
          password: brand.shipHeroPassword
        };
        
        await this.updateShipHeroPO(credentials, existingPO.shipHeroPoId, updates);
      }
      
      console.log(`✅ Purchase Order ${existingPO.poNumber} updated successfully`);
      
      return await this.storage.getPurchaseOrder?.(poId);
      
    } catch (error) {
      console.error('❌ Purchase Order update failed:', error);
      throw error;
    }
  }

  /**
   * Get Purchase Orders for a brand with filtering options
   */
  async getPurchaseOrders(brandId: string, filters?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    supplierName?: string;
  }): Promise<any[]> {
    return await this.storage.getPurchaseOrdersByBrand?.(brandId, filters) || [];
  }

  /**
   * Get Purchase Order details with line items
   */
  async getPurchaseOrderDetails(poId: string): Promise<any> {
    const po = await this.storage.getPurchaseOrder?.(poId);
    if (!po) {
      throw new Error('Purchase Order not found');
    }
    
    const lineItems = await this.storage.getPurchaseOrderItems?.(poId) || [];
    
    return {
      ...po,
      lineItems
    };
  }

  /**
   * Cancel a Purchase Order
   */
  async cancelPurchaseOrder(poId: string): Promise<void> {
    console.log(`❌ Cancelling purchase order: ${poId}`);
    
    try {
      const po = await this.storage.getPurchaseOrder?.(poId);
      if (!po) {
        throw new Error('Purchase Order not found');
      }
      
      // Update status to cancelled
      await this.storage.updatePurchaseOrder?.(poId, {
        status: 'cancelled',
        cancelledAt: new Date(),
        lastSyncAt: new Date()
      });
      
      // Cancel in ShipHero if it exists there
      if (po.shipHeroPoId) {
        const brand = await this.storage.getBrand(po.brandId);
        if (brand?.shipHeroApiKey && brand?.shipHeroPassword) {
          const credentials = {
            username: brand.shipHeroApiKey,
            password: brand.shipHeroPassword
          };
          
          await this.cancelShipHeroPO(credentials, po.shipHeroPoId);
        }
      }
      
      console.log(`✅ Purchase Order ${po.poNumber} cancelled successfully`);
      
    } catch (error) {
      console.error('❌ Purchase Order cancellation failed:', error);
      throw error;
    }
  }

  /**
   * Sync Purchase Order status from ShipHero (called by webhook or scheduled job)
   */
  async syncPurchaseOrderFromShipHero(poId: string): Promise<void> {
    try {
      const po = await this.storage.getPurchaseOrderByShipHeroId?.(poId);
      if (!po) {
        console.warn(`⚠️ Local PO not found for ShipHero PO: ${poId}`);
        return;
      }
      
      const brand = await this.storage.getBrand(po.brandId);
      if (!brand?.shipHeroApiKey || !brand?.shipHeroPassword) {
        console.warn(`⚠️ ShipHero credentials not found for brand: ${po.brandId}`);
        return;
      }
      
      const credentials = {
        username: brand.shipHeroApiKey,
        password: brand.shipHeroPassword
      };
      
      const shipHeroPO = await this.fetchShipHeroPO(credentials, poId);
      
      // Update local record with ShipHero data
      await this.storage.updatePurchaseOrder?.(po.id, {
        status: shipHeroPO.status,
        receivedAt: shipHeroPO.received_at ? new Date(shipHeroPO.received_at) : null,
        shipHeroUpdatedAt: shipHeroPO.updated_at ? new Date(shipHeroPO.updated_at) : null,
        lastSyncAt: new Date()
      });
      
      // Update line items with received quantities
      if (shipHeroPO.line_items) {
        for (const item of shipHeroPO.line_items) {
          await this.storage.updatePurchaseOrderItemByShipHeroId?.(item.id, {
            quantityReceived: item.quantity_received || 0,
            status: item.status || 'pending'
          });
        }
      }
      
    } catch (error) {
      console.error(`❌ PO sync from ShipHero failed for PO ${poId}:`, error);
    }
  }

  // Private helper methods

  private async generatePONumber(brandId: string): Promise<string> {
    const brand = await this.storage.getBrand(brandId);
    const brandCode = brand?.name?.substring(0, 3).toUpperCase() || 'PO';
    const timestamp = Date.now().toString().slice(-6);
    return `${brandCode}-${timestamp}`;
  }

  private async createLocalPurchaseOrder(request: CreatePurchaseOrderRequest & { poNumber: string }): Promise<any> {
    const po = await this.storage.createPurchaseOrder?.({
      brandId: request.brandId,
      poNumber: request.poNumber,
      supplierName: request.supplierName,
      supplierEmail: request.supplierEmail,
      warehouse: request.warehouse,
      expectedDate: request.expectedDate,
      notes: request.notes,
      status: 'draft'
    });
    
    // Create line items
    if (request.lineItems && po) {
      for (const item of request.lineItems) {
        await this.storage.createPurchaseOrderItem?.({
          poId: po.id,
          sku: item.sku,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          expectedDate: item.expectedDate
        });
      }
    }
    
    return po;
  }

  private async createShipHeroPO(credentials: any, poData: ShipHeroPOData): Promise<any> {
    // This would make the actual GraphQL mutation to ShipHero
    // Implementation depends on the ShipHero API service
    
    const mutation = `
      mutation CreatePO($data: CreatePOInput!) {
        po_create(data: $data) {
          request_id
          complexity
          po {
            id
            po_number
            status
          }
        }
      }
    `;
    
    // Mock response for now - would be replaced with actual API call
    return {
      request_id: 'mock-request',
      po: {
        id: 'mock-po-id',
        po_number: poData.po_number,
        status: 'pending'
      }
    };
  }

  private async updateShipHeroPO(credentials: any, poId: string, updates: any): Promise<void> {
    // Implementation for updating PO in ShipHero
    console.log(`🔄 Updating ShipHero PO: ${poId}`);
  }

  private async cancelShipHeroPO(credentials: any, poId: string): Promise<void> {
    // Implementation for cancelling PO in ShipHero
    console.log(`❌ Cancelling ShipHero PO: ${poId}`);
  }

  private async fetchShipHeroPO(credentials: any, poId: string): Promise<any> {
    // Implementation for fetching PO from ShipHero
    return {
      id: poId,
      status: 'pending',
      received_at: null,
      updated_at: new Date().toISOString(),
      line_items: []
    };
  }
}