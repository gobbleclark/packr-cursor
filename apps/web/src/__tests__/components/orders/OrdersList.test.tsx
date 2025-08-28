import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OrdersList from '@/app/orders/page'

// Mock the orders API
const mockOrders = [
  {
    id: 'order-1',
    orderNumber: 'ORD-001',
    status: 'PENDING',
    total: 100.00,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    createdAt: '2024-01-01T00:00:00Z',
    metadata: {
      has_shipments: false,
      shipment_count: 0,
      is_fulfilled: false
    }
  },
  {
    id: 'order-2',
    orderNumber: 'ORD-002',
    status: 'SHIPPED',
    total: 250.00,
    customerName: 'Jane Smith',
    customerEmail: 'jane@example.com',
    createdAt: '2024-01-02T00:00:00Z',
    metadata: {
      has_shipments: true,
      shipment_count: 1,
      is_fulfilled: true
    }
  }
]

// Mock fetch
global.fetch = vi.fn()

const mockFetch = vi.mocked(fetch)

describe('OrdersList', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: mockOrders,
        totalCount: mockOrders.length,
        totalPages: 1,
        currentPage: 1
      })
    } as Response)
  })

  it('should render orders list', async () => {
    render(<OrdersList />)

    // Wait for orders to load
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument()
      expect(screen.getByText('ORD-002')).toBeInTheDocument()
    })

    // Check order details
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.getByText('$250.00')).toBeInTheDocument()
  })

  it('should display order statuses correctly', async () => {
    render(<OrdersList />)

    await waitFor(() => {
      expect(screen.getByText('PENDING')).toBeInTheDocument()
      expect(screen.getByText('SHIPPED')).toBeInTheDocument()
    })
  })

  it('should handle loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<OrdersList />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should handle error state', async () => {
    mockFetch.mockRejectedValue(new Error('API Error'))

    render(<OrdersList />)

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })

  it('should handle empty orders list', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1
      })
    } as Response)

    render(<OrdersList />)

    await waitFor(() => {
      expect(screen.getByText(/no orders found/i)).toBeInTheDocument()
    })
  })

  it('should filter orders by status', async () => {
    const user = userEvent.setup()
    render(<OrdersList />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument()
    })

    // Mock filtered response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: [mockOrders[1]], // Only shipped order
        totalCount: 1,
        totalPages: 1,
        currentPage: 1
      })
    } as Response)

    // Find and click status filter
    const statusFilter = screen.getByRole('combobox', { name: /status/i })
    await user.click(statusFilter)
    
    const shippedOption = screen.getByText('SHIPPED')
    await user.click(shippedOption)

    // Wait for filtered results
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=SHIPPED'),
        expect.any(Object)
      )
    })
  })

  it('should search orders by order number', async () => {
    const user = userEvent.setup()
    render(<OrdersList />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument()
    })

    // Mock search response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: [mockOrders[0]], // Only matching order
        totalCount: 1,
        totalPages: 1,
        currentPage: 1
      })
    } as Response)

    // Find and use search input
    const searchInput = screen.getByPlaceholderText(/search orders/i)
    await user.type(searchInput, 'ORD-001')

    // Wait for search results
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=ORD-001'),
        expect.any(Object)
      )
    })
  })

  it('should paginate orders correctly', async () => {
    const user = userEvent.setup()
    
    // Mock first page response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: mockOrders,
        totalCount: 20,
        totalPages: 2,
        currentPage: 1
      })
    } as Response)

    render(<OrdersList />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument()
    })

    // Mock second page response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: [
          {
            id: 'order-3',
            orderNumber: 'ORD-003',
            status: 'DELIVERED',
            total: 75.00,
            customerName: 'Bob Johnson',
            customerEmail: 'bob@example.com',
            createdAt: '2024-01-03T00:00:00Z',
            metadata: { has_shipments: true, shipment_count: 1, is_fulfilled: true }
          }
        ],
        totalCount: 20,
        totalPages: 2,
        currentPage: 2
      })
    } as Response)

    // Click next page
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Wait for page 2 results
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      )
    })
  })

  it('should handle API authentication errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' })
    } as Response)

    render(<OrdersList />)

    await waitFor(() => {
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument()
    })
  })

  it('should display fulfillment status indicators', async () => {
    render(<OrdersList />)

    await waitFor(() => {
      // Check for fulfillment indicators
      expect(screen.getByText('ORD-001')).toBeInTheDocument()
      expect(screen.getByText('ORD-002')).toBeInTheDocument()
    })

    // Verify shipped order shows fulfillment indicator
    const shippedOrder = screen.getByText('ORD-002').closest('[data-testid="order-row"]')
    expect(shippedOrder).toHaveTextContent('SHIPPED')
  })

  it('should handle real-time order updates via WebSocket', async () => {
    const mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true
    }

    // Mock socket connection
    vi.mocked(require('socket.io-client').io).mockReturnValue(mockSocket)

    render(<OrdersList />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument()
    })

    // Verify socket listeners were set up
    expect(mockSocket.on).toHaveBeenCalledWith('order:updated', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('order:created', expect.any(Function))
  })

  it('should refresh data when refresh button is clicked', async () => {
    const user = userEvent.setup()
    render(<OrdersList />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument()
    })

    // Clear mock calls
    mockFetch.mockClear()

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await user.click(refreshButton)

    // Verify API was called again
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
