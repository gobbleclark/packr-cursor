/**
 * Mock ShipHero API Service for Local Testing
 * This simulates real ShipHero API responses using your actual account structure
 * Only used when SHIPHERO_MOCK_MODE=true environment variable is set
 */

interface ShipHeroCredentials {
  username: string;
  password: string;
}

export class MockShipHeroApiService {
  private baseUrl = 'https://api.shiphero.com/graphql';

  async getOrders(credentials: ShipHeroCredentials, fromDate?: Date): Promise<any[]> {
    console.log(`🧪 MOCK: Fetching ShipHero orders for ${credentials.username} from ${fromDate?.toISOString()}`);
    
    // Simulate realistic order data for Mabē brand
    const mockOrders = [
      {
        id: "gid://ShipHero/Order/12345001",
        order_number: "MABE-2025-001",
        shop_name: "Mabē Store",
        fulfillment_status: "shipped",
        order_date: "2025-07-28T10:00:00Z",
        total_price: "89.99",
        subtotal: "79.99", 
        total_discounts: "0.00",
        total_tax: "10.00",
        email: "customer@example.com",
        profile: {
          name: "Jane Customer"
        },
        shipping_address: {
          first_name: "Jane",
          last_name: "Customer", 
          address1: "123 Main St",
          address2: "Apt 4B",
          city: "New York",
          state: "NY",
          country: "US",
          zip: "10001",
          phone: "555-123-4567"
        },
        line_items: [
          {
            id: "gid://ShipHero/LineItem/67890001",
            title: "Organic Cotton T-Shirt",
            quantity: 2,
            price: "39.99",
            sku: "MABE-TSHIRT-001",
            product_id: "gid://ShipHero/Product/11111001"
          }
        ],
        shipments: [
          {
            id: "gid://ShipHero/Shipment/99999001", 
            carrier: "UPS",
            method: "Ground",
            tracking_number: "1Z999AA1234567890",
            tracking_url: "https://www.ups.com/track?tracknum=1Z999AA1234567890",
            status: "delivered"
          }
        ]
      },
      {
        id: "gid://ShipHero/Order/12345002",
        order_number: "MABE-2025-002", 
        shop_name: "Mabē Store",
        fulfillment_status: "processing",
        order_date: "2025-07-29T14:30:00Z",
        total_price: "159.98",
        subtotal: "145.44",
        total_discounts: "5.00", 
        total_tax: "14.54",
        email: "john.doe@email.com",
        profile: {
          name: "John Doe"
        },
        shipping_address: {
          first_name: "John",
          last_name: "Doe",
          address1: "456 Oak Avenue", 
          address2: "",
          city: "Los Angeles",
          state: "CA", 
          country: "US",
          zip: "90210",
          phone: "555-987-6543"
        },
        line_items: [
          {
            id: "gid://ShipHero/LineItem/67890002",
            title: "Eco-Friendly Hoodie",
            quantity: 1,
            price: "79.99", 
            sku: "MABE-HOODIE-001",
            product_id: "gid://ShipHero/Product/11111002"
          },
          {
            id: "gid://ShipHero/LineItem/67890003", 
            title: "Sustainable Jeans",
            quantity: 1,
            price: "69.99",
            sku: "MABE-JEANS-001", 
            product_id: "gid://ShipHero/Product/11111003"
          }
        ],
        shipments: []
      }
    ];

    // Add more recent orders to simulate a busy Mabē store
    const additionalOrders = [
      {
        id: "gid://ShipHero/Order/12345003",
        order_number: "MABE-2025-003",
        shop_name: "Mabē Store",
        fulfillment_status: "processing",
        order_date: "2025-07-30T09:15:00Z",
        total_price: "49.99",
        subtotal: "39.99",
        total_discounts: "0.00",
        total_tax: "10.00",
        email: "sarah.jones@email.com",
        profile: { name: "Sarah Jones" },
        shipping_address: {
          first_name: "Sarah", last_name: "Jones",
          address1: "789 Pine Street", address2: "",
          city: "Seattle", state: "WA", country: "US", zip: "98101",
          phone: "555-456-7890"
        },
        line_items: [{
          id: "gid://ShipHero/LineItem/67890004",
          title: "Organic Cotton T-Shirt",
          quantity: 1,
          price: "39.99",
          sku: "MABE-TSHIRT-001",
          product_id: "gid://ShipHero/Product/11111001"
        }],
        shipments: []
      },
      {
        id: "gid://ShipHero/Order/12345004",
        order_number: "MABE-2025-004", 
        shop_name: "Mabē Store",
        fulfillment_status: "shipped",
        order_date: "2025-07-31T16:22:00Z",
        total_price: "149.98",
        subtotal: "139.98",
        total_discounts: "10.00",
        total_tax: "10.00",
        email: "mike.chen@gmail.com",
        profile: { name: "Mike Chen" },
        shipping_address: {
          first_name: "Mike", last_name: "Chen",
          address1: "456 Oak Avenue", address2: "Suite 200",
          city: "San Francisco", state: "CA", country: "US", zip: "94102",
          phone: "555-789-0123"
        },
        line_items: [
          {
            id: "gid://ShipHero/LineItem/67890005",
            title: "Eco-Friendly Hoodie",
            quantity: 1,
            price: "79.99",
            sku: "MABE-HOODIE-001",
            product_id: "gid://ShipHero/Product/11111002"
          },
          {
            id: "gid://ShipHero/LineItem/67890006",
            title: "Sustainable Jeans", 
            quantity: 1,
            price: "69.99",
            sku: "MABE-JEANS-001",
            product_id: "gid://ShipHero/Product/11111003"
          }
        ],
        shipments: [{
          id: "gid://ShipHero/Shipment/99999002",
          carrier: "FedEx",
          method: "Ground",
          tracking_number: "773123456789",
          tracking_url: "https://www.fedex.com/apps/fedextrack/?tracknumber=773123456789",
          status: "in_transit"
        }]
      }
    ];

    const allOrders = [...mockOrders, ...additionalOrders];
    
    // Filter by date if provided
    if (fromDate) {
      return allOrders.filter(order => new Date(order.order_date) >= fromDate);
    }
    
    return allOrders;
  }

  async getProducts(credentials: ShipHeroCredentials): Promise<any[]> {
    console.log(`🧪 MOCK: Fetching ShipHero products for ${credentials.username}`);
    
    // Simulate realistic product data for Mabē brand
    const mockProducts = [
      {
        id: "gid://ShipHero/Product/11111001",
        name: "Organic Cotton T-Shirt",
        sku: "MABE-TSHIRT-001", 
        price: "39.99",
        value: "39.99",
        barcode: "1234567890123",
        country_of_origin: "US",
        customs_description: "Organic cotton t-shirt", 
        weight: "0.3",
        height: "1.0",
        width: "12.0",
        length: "8.0",
        kit: false,
        kit_build: false,
        no_air: false,
        final_sale: false,
        customs_value: "39.99",
        customs_description_2: "",
        not_owned: false,
        dropship: false,
        needs_serial_number: false,
        thumbnail: "https://example.com/tshirt-thumb.jpg",
        large_thumbnail: "https://example.com/tshirt-large.jpg", 
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-28T12:00:00Z",
        product_note: "Premium organic cotton, machine washable",
        sync_inventories: true,
        tags: "organic,cotton,sustainable",
        total_on_hand: 150,
        total_committed: 12,
        total_available: 138,
        total_allocated: 8,
        total_backordered: 0,
        warehouse_products: [
          {
            id: "gid://ShipHero/WarehouseProduct/22222001",
            warehouse_id: "gid://ShipHero/Warehouse/33333001",
            on_hand: 150,
            allocated: 8,
            available: 138, 
            committed: 12,
            backordered: 0,
            pending: 0,
            sellable: 138,
            non_sellable: 4,
            received: 150
          }
        ]
      },
      {
        id: "gid://ShipHero/Product/11111002",
        name: "Eco-Friendly Hoodie",
        sku: "MABE-HOODIE-001",
        price: "79.99", 
        value: "79.99",
        barcode: "1234567890124",
        country_of_origin: "US",
        customs_description: "Eco-friendly hoodie",
        weight: "0.8",
        height: "2.0", 
        width: "14.0",
        length: "12.0",
        kit: false,
        kit_build: false,
        no_air: false,
        final_sale: false,
        customs_value: "79.99",
        customs_description_2: "",
        not_owned: false,
        dropship: false,
        needs_serial_number: false,
        thumbnail: "https://example.com/hoodie-thumb.jpg",
        large_thumbnail: "https://example.com/hoodie-large.jpg",
        created_at: "2025-01-01T00:00:00Z", 
        updated_at: "2025-01-29T09:00:00Z",
        product_note: "Recycled materials, fair trade certified",
        sync_inventories: true,
        tags: "eco-friendly,hoodie,recycled",
        total_on_hand: 75,
        total_committed: 5,
        total_available: 70,
        total_allocated: 3,
        total_backordered: 0,
        warehouse_products: [
          {
            id: "gid://ShipHero/WarehouseProduct/22222002",
            warehouse_id: "gid://ShipHero/Warehouse/33333001", 
            on_hand: 75,
            allocated: 3,
            available: 70,
            committed: 5,
            backordered: 0,
            pending: 0,
            sellable: 70,
            non_sellable: 2,
            received: 75
          }
        ]
      },
      {
        id: "gid://ShipHero/Product/11111003",
        name: "Sustainable Jeans",
        sku: "MABE-JEANS-001",
        price: "69.99",
        value: "69.99", 
        barcode: "1234567890125",
        country_of_origin: "US",
        customs_description: "Sustainable denim jeans",
        weight: "0.6",
        height: "1.5",
        width: "16.0",
        length: "10.0", 
        kit: false,
        kit_build: false,
        no_air: false,
        final_sale: false,
        customs_value: "69.99",
        customs_description_2: "",
        not_owned: false,
        dropship: false,
        needs_serial_number: false,
        thumbnail: "https://example.com/jeans-thumb.jpg",
        large_thumbnail: "https://example.com/jeans-large.jpg",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-29T11:00:00Z", 
        product_note: "Sustainable denim, water-saving production",
        sync_inventories: true,
        tags: "sustainable,jeans,denim",
        total_on_hand: 90,
        total_committed: 7,
        total_available: 83,
        total_allocated: 5,
        total_backordered: 0,
        warehouse_products: [
          {
            id: "gid://ShipHero/WarehouseProduct/22222003",
            warehouse_id: "gid://ShipHero/Warehouse/33333001",
            on_hand: 90,
            allocated: 5,
            available: 83,
            committed: 7, 
            backordered: 0,
            pending: 0,
            sellable: 83,
            non_sellable: 2,
            received: 90
          }
        ]
      }
    ];
    
    return mockProducts;
  }

  async getInventory(credentials: ShipHeroCredentials): Promise<any[]> {
    console.log(`🧪 MOCK: Fetching ShipHero inventory for ${credentials.username}`);
    return [];
  }
}

export const mockShipHeroApi = new MockShipHeroApiService();