import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChat } from '@/hooks/useChat'

// Mock Socket.IO
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}))

// Mock fetch
global.fetch = vi.fn()

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocket.on.mockClear()
    mockSocket.off.mockClear()
    mockSocket.emit.mockClear()
  })

  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useChat('room-1'))

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isConnected).toBe(false)
  })

  it('should connect to socket and join room', () => {
    renderHook(() => useChat('room-1'))

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('typing', expect.any(Function))
    expect(mockSocket.emit).toHaveBeenCalledWith('join-room', 'room-1')
  })

  it('should load initial messages', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        content: 'Hello world',
        userId: 'user-1',
        roomId: 'room-1',
        createdAt: '2024-01-01T00:00:00Z',
        user: { firstName: 'John', lastName: 'Doe' }
      }
    ]

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: mockMessages })
    } as Response)

    const { result } = renderHook(() => useChat('room-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.messages).toEqual(mockMessages)
    expect(fetch).toHaveBeenCalledWith('/api/chat/room-1/messages', {
      headers: { 'Content-Type': 'application/json' }
    })
  })

  it('should send message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] })
    } as Response)

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'msg-2',
        content: 'New message',
        userId: 'user-1',
        roomId: 'room-1'
      })
    } as Response)

    const { result } = renderHook(() => useChat('room-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.sendMessage('New message')
    })

    expect(fetch).toHaveBeenCalledWith('/api/chat/room-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'New message' })
    })
  })

  it('should handle typing indicators', () => {
    const { result } = renderHook(() => useChat('room-1'))

    act(() => {
      result.current.startTyping()
    })

    expect(mockSocket.emit).toHaveBeenCalledWith('typing-start', 'room-1')

    act(() => {
      result.current.stopTyping()
    })

    expect(mockSocket.emit).toHaveBeenCalledWith('typing-stop', 'room-1')
  })

  it('should handle incoming messages via socket', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] })
    } as Response)

    const { result } = renderHook(() => useChat('room-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const newMessage = {
      id: 'msg-3',
      content: 'Socket message',
      userId: 'user-2',
      roomId: 'room-1',
      createdAt: '2024-01-01T01:00:00Z',
      user: { firstName: 'Jane', lastName: 'Smith' }
    }

    // Simulate receiving a message via socket
    const messageHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]

    act(() => {
      messageHandler?.(newMessage)
    })

    expect(result.current.messages).toContainEqual(newMessage)
  })

  it('should handle connection status changes', () => {
    const { result } = renderHook(() => useChat('room-1'))

    // Simulate connection
    const connectHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'connect'
    )?.[1]

    act(() => {
      connectHandler?.()
    })

    expect(result.current.isConnected).toBe(true)

    // Simulate disconnection
    const disconnectHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'disconnect'
    )?.[1]

    act(() => {
      disconnectHandler?.()
    })

    expect(result.current.isConnected).toBe(false)
  })

  it('should handle typing users', () => {
    const { result } = renderHook(() => useChat('room-1'))

    const typingHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'typing'
    )?.[1]

    act(() => {
      typingHandler?.({
        userId: 'user-2',
        isTyping: true,
        user: { firstName: 'Jane', lastName: 'Smith' }
      })
    })

    expect(result.current.typingUsers).toContainEqual({
      userId: 'user-2',
      user: { firstName: 'Jane', lastName: 'Smith' }
    })

    act(() => {
      typingHandler?.({
        userId: 'user-2',
        isTyping: false
      })
    })

    expect(result.current.typingUsers).toEqual([])
  })

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useChat('room-1'))

    unmount()

    expect(mockSocket.off).toHaveBeenCalledWith('connect')
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect')
    expect(mockSocket.off).toHaveBeenCalledWith('message')
    expect(mockSocket.off).toHaveBeenCalledWith('typing')
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('should handle API errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useChat('room-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBe('Failed to load messages')
  })

  it('should handle send message errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] })
    } as Response)

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Send failed'))

    const { result } = renderHook(() => useChat('room-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.sendMessage('Failed message')
    })

    expect(result.current.error).toBe('Failed to send message')
  })

  it('should debounce typing indicators', async () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useChat('room-1'))

    act(() => {
      result.current.startTyping()
      result.current.startTyping()
      result.current.startTyping()
    })

    // Should only emit once despite multiple calls
    expect(mockSocket.emit).toHaveBeenCalledTimes(2) // join-room + typing-start

    // Fast forward time to trigger stop typing
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(mockSocket.emit).toHaveBeenCalledWith('typing-stop', 'room-1')

    vi.useRealTimers()
  })
})
