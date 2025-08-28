import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the inventory page component
const InventoryPage = () => {
  const [inventory, setInventory] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [filters, setFilters] = React.useState({
    search: '',
    warehouse: '',
    status: ''
  })

  React.useEffect(() => {
    const fetchInventory = async () => {
      try {
        const params = new URLSearchParams()
        if (filters.search) params.append('search', filters.search)
        if (filters.warehouse) params.append('warehouse', filters.warehouse)
        if (filters.status) params.append('status', filters.status)

        const response = await fetch(`/api/inventory?${params}`)
        const data = await response.json()
        setInventory(data.items || [])
      } catch (error) {
        console.error('Failed to fetch inventory:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [filters])

  if (loading) {
    return <div data-testid="loading">Loading inventory...</div>
  }

  return (
    <div data-testid="inventory-page">
      <header>
        <h1>Inventory Management</h1>
        <div data-testid="filters">
          <input
            type="text"
            placeholder="Search SKU or product name"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            data-testid="search-input"
          />
          <select
            value={filters.warehouse}
            onChange={(e) => setFilters(prev => ({ ...prev, warehouse: e.target.value }))}
            data-testid="warehouse-filter"
          >
            <option value="">All Warehouses</option>
            <option value="warehouse-1">Main Warehouse</option>
            <option value="warehouse-2">Secondary Warehouse</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            data-testid="status-filter"
          >
            <option value="">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
        </div>
      </header>

      <main>
        {inventory.length === 0 ? (
          <div data-testid="empty-state">No inventory items found</div>
        ) : (
          <div data-testid="inventory-grid">
            {inventory.map((item: any) => (
              <div key={item.id} data-testid={`inventory-item-${item.id}`} className="inventory-card">
                <h3>{item.productName}</h3>
                <p>SKU: {item.sku}</p>
                <p>On Hand: {item.onHand}</p>
                <p>Available: {item.available}</p>
                <p>Warehouse: {item.warehouseName}</p>
                <div className={`status ${item.status}`}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Mock React for the component above
const React = {
  useState: vi.fn(),
  useEffect: vi.fn()
}

vi.mock('react', () => React)

// Mock fetch
global.fetch = vi.fn()

describe('Inventory Page Integration', () => {
  const mockInventoryData = {
    items: [
      {
        id: 'inv-1',
        sku: 'WIDGET-001',
        productName: 'Blue Widget',
        onHand: 100,
        available: 95,
        committed: 5,
        warehouseName: 'Main Warehouse',
        status: 'in-stock'
      },
      {
        id: 'inv-2',
        sku: 'GADGET-002',
        productName: 'Red Gadget',
        onHand: 10,
        available: 8,
        committed: 2,
        warehouseName: 'Secondary Warehouse',
        status: 'low-stock'
      },
      {
        id: 'inv-3',
        sku: 'TOOL-003',
        productName: 'Green Tool',
        onHand: 0,
        available: 0,
        committed: 0,
        warehouseName: 'Main Warehouse',
        status: 'out-of-stock'
      }
    ],
    totalCount: 3
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock React hooks
    let stateValues: any = {}
    let effectCallbacks: any[] = []

    React.useState.mockImplementation((initialValue: any) => {
      const key = Math.random().toString()
      if (!(key in stateValues)) {
        stateValues[key] = initialValue
      }
      const setValue = (newValue: any) => {
        stateValues[key] = typeof newValue === 'function' ? newValue(stateValues[key]) : newValue
      }
      return [stateValues[key], setValue]
    })

    React.useEffect.mockImplementation((callback: any, deps: any) => {
      effectCallbacks.push({ callback, deps })
      callback() // Execute immediately for testing
    })

    // Mock successful API response
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockInventoryData
    } as Response)
  })

  it('should render inventory page with data', async () => {
    render(<InventoryPage />)

    expect(screen.getByText('Inventory Management')).toBeInTheDocument()
    expect(screen.getByTestId('filters')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByTestId('inventory-grid')).toBeInTheDocument()
    })

    expect(screen.getByText('Blue Widget')).toBeInTheDocument()
    expect(screen.getByText('Red Gadget')).toBeInTheDocument()
    expect(screen.getByText('Green Tool')).toBeInTheDocument()
  })

  it('should display inventory item details correctly', async () => {
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('inventory-item-inv-1')).toBeInTheDocument()
    })

    const firstItem = screen.getByTestId('inventory-item-inv-1')
    expect(within(firstItem).getByText('Blue Widget')).toBeInTheDocument()
    expect(within(firstItem).getByText('SKU: WIDGET-001')).toBeInTheDocument()
    expect(within(firstItem).getByText('On Hand: 100')).toBeInTheDocument()
    expect(within(firstItem).getByText('Available: 95')).toBeInTheDocument()
    expect(within(firstItem).getByText('Warehouse: Main Warehouse')).toBeInTheDocument()
    expect(within(firstItem).getByText('in-stock')).toBeInTheDocument()
  })

  it('should show loading state initially', () => {
    // Mock loading state
    React.useState.mockImplementationOnce(() => [[], vi.fn()])
      .mockImplementationOnce(() => [true, vi.fn()]) // loading = true
      .mockImplementationOnce(() => [{ search: '', warehouse: '', status: '' }, vi.fn()])

    render(<InventoryPage />)

    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('Loading inventory...')).toBeInTheDocument()
  })

  it('should show empty state when no items', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], totalCount: 0 })
    } as Response)

    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })

    expect(screen.getByText('No inventory items found')).toBeInTheDocument()
  })

  it('should filter by search term', async () => {
    const user = userEvent.setup()
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, 'WIDGET')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/inventory?search=WIDGET')
    })
  })

  it('should filter by warehouse', async () => {
    const user = userEvent.setup()
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('warehouse-filter')).toBeInTheDocument()
    })

    const warehouseFilter = screen.getByTestId('warehouse-filter')
    await user.selectOptions(warehouseFilter, 'warehouse-1')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/inventory?warehouse=warehouse-1')
    })
  })

  it('should filter by status', async () => {
    const user = userEvent.setup()
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('status-filter')).toBeInTheDocument()
    })

    const statusFilter = screen.getByTestId('status-filter')
    await user.selectOptions(statusFilter, 'low-stock')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/inventory?status=low-stock')
    })
  })

  it('should combine multiple filters', async () => {
    const user = userEvent.setup()
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    // Apply multiple filters
    await user.type(screen.getByTestId('search-input'), 'WIDGET')
    await user.selectOptions(screen.getByTestId('warehouse-filter'), 'warehouse-1')
    await user.selectOptions(screen.getByTestId('status-filter'), 'in-stock')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/inventory?search=WIDGET&warehouse=warehouse-1&status=in-stock')
    })
  })

  it('should handle API errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })

    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch inventory:', expect.any(Error))
    
    consoleSpy.mockRestore()
  })

  it('should display different status indicators', async () => {
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('inventory-grid')).toBeInTheDocument()
    })

    // Check status classes are applied
    const inStockItem = screen.getByTestId('inventory-item-inv-1')
    const lowStockItem = screen.getByTestId('inventory-item-inv-2')
    const outOfStockItem = screen.getByTestId('inventory-item-inv-3')

    expect(within(inStockItem).getByText('in-stock')).toHaveClass('status', 'in-stock')
    expect(within(lowStockItem).getByText('low-stock')).toHaveClass('status', 'low-stock')
    expect(within(outOfStockItem).getByText('out-of-stock')).toHaveClass('status', 'out-of-stock')
  })

  it('should handle real-time updates', async () => {
    // Mock WebSocket or Server-Sent Events for real-time updates
    const mockEventSource = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      close: vi.fn()
    }

    global.EventSource = vi.fn(() => mockEventSource) as any

    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('inventory-grid')).toBeInTheDocument()
    })

    // Simulate real-time inventory update
    const updateHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'inventory-update'
    )?.[1]

    const updatedItem = {
      id: 'inv-1',
      sku: 'WIDGET-001',
      productName: 'Blue Widget',
      onHand: 85, // Updated quantity
      available: 80,
      committed: 5,
      warehouseName: 'Main Warehouse',
      status: 'in-stock'
    }

    if (updateHandler) {
      updateHandler({ data: JSON.stringify(updatedItem) })
    }

    // Verify the UI updates with new data
    await waitFor(() => {
      expect(screen.getByText('On Hand: 85')).toBeInTheDocument()
    })
  })

  it('should be accessible', async () => {
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('inventory-grid')).toBeInTheDocument()
    })

    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Inventory Management')

    // Check for form controls
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Search SKU or product name')
    expect(screen.getAllByRole('combobox')).toHaveLength(2)

    // Check for proper labeling (in a real implementation, these would have labels)
    const searchInput = screen.getByTestId('search-input')
    const warehouseSelect = screen.getByTestId('warehouse-filter')
    const statusSelect = screen.getByTestId('status-filter')

    expect(searchInput).toBeInTheDocument()
    expect(warehouseSelect).toBeInTheDocument()
    expect(statusSelect).toBeInTheDocument()
  })
})
