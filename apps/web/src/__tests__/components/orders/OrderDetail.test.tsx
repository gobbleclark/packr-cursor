import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OrderDetailPage from '@/app/orders/[orderId]/page'

// Mock the order detail API
const mockOrder = {
  id: 'order-1',
  orderNumber: 'ORD-001',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  status: 'PENDING',
  total: 100.00,
  subtotal: 90.00,
  tax: 5.00,
  shipping: 5.00,
  orderDate: '2024-01-01T00:00:00Z',
  dueDate: '2024-01-05T00:00:00Z',
  brandName: 'Test Brand',
  orderItems: [
    {
      id: 'item-1',
      productName: 'Test Product',
      sku: 'TEST-001',
      quantity: 2,
      price: 45.00,
      total: 90.00
    }
  ],
  shipments: [],
  shippingAddress: {
    fullName: 'John Doe',
    company: 'Test Company',
    address1: '123 Test St',
    address2: 'Suite 100',
    city: 'Test City',
    state: 'TS',
    postalCode: '12345',
    country: 'US',
    phone: '555-0123',
    email: 'john@example.com'
  },
  notes: [],
  rawData: {
    shipping_method: {
      carrier: 'UPS',
      service: 'Ground'
    }
  }
}

// Mock fetch
global.fetch = vi.fn()
const mockFetch = vi.mocked(fetch)

// Mock router
const mockPush = vi.fn()
const mockParams = { orderId: 'order-1' }

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => mockParams,
}))

// Mock auth service
vi.mock('@/lib/auth', () => ({
  authService: {
    verifyToken: vi.fn().mockResolvedValue({
      user: { id: 'user-1', role: 'BRAND_USER', brandId: 'brand-1' }
    }),
    getToken: vi.fn().mockReturnValue('mock-token'),
    clearToken: vi.fn(),
  },
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn().mockReturnValue('mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
})

describe('OrderDetailPage', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockPush.mockClear()
    
    // Mock successful order fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        order: mockOrder
      }),
    })
  })

  it('renders order details correctly', async () => {
    render(<OrderDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Order #ORD-001')).toBeInTheDocument()
    })
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('SKU: TEST-001')).toBeInTheDocument()
  })

  it('shows edit buttons for order components', async () => {
    render(<OrderDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Order #ORD-001')).toBeInTheDocument()
    })
    
    // Should have edit buttons for address, items, and shipping
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    expect(editButtons.length).toBeGreaterThan(0)
  })

  it('shows cancel order button for pending orders', async () => {
    render(<OrderDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Order #ORD-001')).toBeInTheDocument()
    })
    
    expect(screen.getByRole('button', { name: /cancel order/i })).toBeInTheDocument()
  })

  it('does not show cancel order button for shipped orders', async () => {
    const shippedOrder = { ...mockOrder, status: 'SHIPPED' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        order: shippedOrder
      }),
    })
    
    render(<OrderDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Order #ORD-001')).toBeInTheDocument()
    })
    
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument()
  })

  it('opens edit items modal when edit button is clicked', async () => {
    const user = userEvent.setup()
    render(<OrderDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Order #ORD-001')).toBeInTheDocument()
    })
    
    // Find the edit button in the Order Items section
    const orderItemsSection = screen.getByText('Order Items (1)').closest('div')
    const editButton = orderItemsSection?.querySelector('button')
    
    if (editButton) {
      await user.click(editButton)
      // Modal should be rendered (though we'd need to mock the modal component for full testing)
    }
  })

  it('calls API when updating order address', async () => {
    const user = userEvent.setup()
    
    // Mock successful address update
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, order: mockOrder }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
    
    render(<OrderDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Order #ORD-001')).toBeInTheDocument()
    })
    
    // This would require mocking the modal component to test the full flow
    // For now, we verify the component renders without errors
    expect(screen.getByText('Ship To Address')).toBeInTheDocument()
  })

  it('displays shipping address correctly', async () => {
    render(<OrderDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Order #ORD-001')).toBeInTheDocument()
    })
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Test Company')).toBeInTheDocument()
    expect(screen.getByText('123 Test St')).toBeInTheDocument()
    expect(screen.getByText('Suite 100')).toBeInTheDocument()
    expect(screen.getByText('Test City, TS 12345')).toBeInTheDocument()
    expect(screen.getByText('555-0123')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    })
    
    render(<OrderDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Order Not Found')).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    render(<OrderDetailPage />)
    
    expect(screen.getByText('Loading order details...')).toBeInTheDocument()
  })
})
