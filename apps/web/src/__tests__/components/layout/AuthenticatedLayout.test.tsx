import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'

// Mock the Navigation component
vi.mock('@/components/layout/Navigation', () => ({
  Navigation: ({ user, onLogout }: { user: any; onLogout: () => void }) => (
    <nav data-testid="navigation">
      <div data-testid="user-info">{user?.firstName} {user?.lastName}</div>
      <button onClick={onLogout} data-testid="logout-button">Logout</button>
    </nav>
  )
}))

describe('AuthenticatedLayout', () => {
  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com'
  }

  const mockOnLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render layout with navigation and header', () => {
    render(
      <AuthenticatedLayout user={mockUser} onLogout={mockOnLogout}>
        <div data-testid="page-content">Test Content</div>
      </AuthenticatedLayout>
    )

    expect(screen.getByTestId('navigation')).toBeInTheDocument()
    expect(screen.getByText('Packr Portal')).toBeInTheDocument()
    expect(screen.getByText('Welcome, John Doe')).toBeInTheDocument()
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
  })

  it('should display user name in header', () => {
    render(
      <AuthenticatedLayout user={mockUser} onLogout={mockOnLogout}>
        <div>Content</div>
      </AuthenticatedLayout>
    )

    expect(screen.getByText('Welcome, John Doe')).toBeInTheDocument()
  })

  it('should handle user with only first name', () => {
    const userWithOnlyFirstName = {
      id: 'user-2',
      firstName: 'Jane',
      lastName: undefined
    }

    render(
      <AuthenticatedLayout user={userWithOnlyFirstName} onLogout={mockOnLogout}>
        <div>Content</div>
      </AuthenticatedLayout>
    )

    expect(screen.getByText('Welcome, Jane')).toBeInTheDocument()
  })

  it('should handle missing user gracefully', () => {
    render(
      <AuthenticatedLayout user={null} onLogout={mockOnLogout}>
        <div>Content</div>
      </AuthenticatedLayout>
    )

    expect(screen.getByText('Welcome,')).toBeInTheDocument()
  })

  it('should pass user and onLogout to Navigation component', () => {
    render(
      <AuthenticatedLayout user={mockUser} onLogout={mockOnLogout}>
        <div>Content</div>
      </AuthenticatedLayout>
    )

    expect(screen.getByTestId('user-info')).toHaveTextContent('John Doe')
    expect(screen.getByTestId('logout-button')).toBeInTheDocument()
  })

  it('should render children in main content area', () => {
    const testContent = (
      <div>
        <h2>Test Page</h2>
        <p>This is test content</p>
        <button>Test Button</button>
      </div>
    )

    render(
      <AuthenticatedLayout user={mockUser} onLogout={mockOnLogout}>
        {testContent}
      </AuthenticatedLayout>
    )

    expect(screen.getByText('Test Page')).toBeInTheDocument()
    expect(screen.getByText('This is test content')).toBeInTheDocument()
    expect(screen.getByText('Test Button')).toBeInTheDocument()
  })

  it('should have proper layout structure', () => {
    const { container } = render(
      <AuthenticatedLayout user={mockUser} onLogout={mockOnLogout}>
        <div data-testid="content">Content</div>
      </AuthenticatedLayout>
    )

    // Check main layout structure
    const mainContainer = container.querySelector('.min-h-screen.bg-gray-50.flex')
    expect(mainContainer).toBeInTheDocument()

    // Check header structure
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('bg-white', 'shadow-sm', 'border-b')

    // Check main content area
    const main = screen.getByRole('main')
    expect(main).toHaveClass('flex-1', 'overflow-y-auto')
    expect(main).toContainElement(screen.getByTestId('content'))
  })

  it('should have responsive design classes', () => {
    const { container } = render(
      <AuthenticatedLayout user={mockUser} onLogout={mockOnLogout}>
        <div>Content</div>
      </AuthenticatedLayout>
    )

    // Check responsive padding classes
    const headerContainer = container.querySelector('.max-w-7xl')
    expect(headerContainer).toHaveClass('px-4', 'sm:px-6', 'lg:px-8')
  })

  it('should maintain accessibility standards', () => {
    render(
      <AuthenticatedLayout user={mockUser} onLogout={mockOnLogout}>
        <div>Content</div>
      </AuthenticatedLayout>
    )

    // Check for proper semantic HTML
    expect(screen.getByRole('banner')).toBeInTheDocument() // header
    expect(screen.getByRole('main')).toBeInTheDocument() // main
    
    // Check heading hierarchy
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Packr Portal')
  })

  it('should handle complex children components', () => {
    const ComplexChild = () => (
      <div>
        <header>Child Header</header>
        <section>
          <article>Article content</article>
          <aside>Sidebar content</aside>
        </section>
        <footer>Child Footer</footer>
      </div>
    )

    render(
      <AuthenticatedLayout user={mockUser} onLogout={mockOnLogout}>
        <ComplexChild />
      </AuthenticatedLayout>
    )

    expect(screen.getByText('Child Header')).toBeInTheDocument()
    expect(screen.getByText('Article content')).toBeInTheDocument()
    expect(screen.getByText('Sidebar content')).toBeInTheDocument()
    expect(screen.getByText('Child Footer')).toBeInTheDocument()
  })
})
