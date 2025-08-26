import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock API handlers
export const handlers = [
  // Mock Trackstar API
  http.get('https://production.trackstarhq.com/wms/orders', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'order-1',
          order_number: 'ORD-001',
          status: 'open',
          total_price: 100.00,
          customer_id: 'cust-1',
          ship_to_address: {
            full_name: 'John Doe',
            email_address: 'john@example.com'
          },
          line_items: [
            {
              id: 'item-1',
              sku: 'TEST-SKU-001',
              quantity: 2,
              unit_price: 50.00
            }
          ],
          shipments: []
        }
      ],
      next_token: null,
      total_count: 1
    })
  }),

  http.get('https://production.trackstarhq.com/wms/products', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'prod-1',
          sku: 'TEST-SKU-001',
          name: 'Test Product',
          price: 50.00,
          category: 'Electronics'
        }
      ],
      next_token: null,
      total_count: 1
    })
  }),

  http.get('https://production.trackstarhq.com/wms/inventory', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'inv-1',
          sku: 'TEST-SKU-001',
          onhand: 100,
          fulfillable: 95,
          committed: 5,
          locations: [
            {
              location_id: 'loc-1',
              name: 'Main Warehouse',
              quantity: 100
            }
          ]
        }
      ],
      next_token: null,
      total_count: 1
    })
  }),

  // Mock internal API endpoints
  http.get('/api/orders', () => {
    return HttpResponse.json({
      orders: [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'PENDING',
          total: 100.00,
          customerName: 'John Doe',
          createdAt: new Date().toISOString()
        }
      ],
      totalCount: 1
    })
  }),

  http.get('/api/inventory', () => {
    return HttpResponse.json({
      items: [
        {
          id: 'inv-1',
          sku: 'TEST-SKU-001',
          productName: 'Test Product',
          onHand: 100,
          available: 95,
          warehouseName: 'Main Warehouse'
        }
      ],
      totalCount: 1
    })
  }),

  // Mock webhook endpoints
  http.post('/api/webhooks/trackstar/inventory', () => {
    return HttpResponse.json({ success: true })
  })
]

export const server = setupServer(...handlers)
