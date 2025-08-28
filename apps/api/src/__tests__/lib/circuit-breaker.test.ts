import { CircuitBreaker, CircuitBreakerState, circuitBreakerManager } from '../../lib/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000, // 1 second for faster tests
      monitoringWindowMs: 5000, // 5 seconds
      name: 'test-breaker'
    });
  });

  describe('basic functionality', () => {
    it('should execute function successfully when circuit is closed', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should record failures but stay closed below threshold', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));

      // Fail twice (below threshold of 3)
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitBreakerState.CLOSED);
      expect(stats.failureCount).toBe(2);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should open circuit after reaching failure threshold', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));

      // Fail 3 times to reach threshold
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');

      // Circuit should now be open
      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.OPEN);

      // Next call should fail immediately without calling the function
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN');
      expect(mockFn).toHaveBeenCalledTimes(3); // Should not increase
    });

    it('should reject requests immediately when circuit is open', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));

      // Open the circuit
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();

      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.OPEN);

      // Multiple subsequent calls should fail immediately
      const startTime = Date.now();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN');
      const endTime = Date.now();

      // Should fail fast (< 10ms)
      expect(endTime - startTime).toBeLessThan(10);
      expect(mockFn).toHaveBeenCalledTimes(3); // Should not increase
    });
  });

  describe('half-open state and recovery', () => {
    beforeEach(async () => {
      // Open the circuit first
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.OPEN);
    });

    it('should transition to half-open after reset timeout', async () => {
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait 1.1 seconds

      const mockFn = jest.fn().mockResolvedValue('success');
      
      // First call after timeout should transition to half-open then succeed
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.CLOSED);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should close circuit on successful half-open attempt', async () => {
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      const mockFn = jest.fn().mockResolvedValue('recovered');
      
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('recovered');
      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.CLOSED);
      
      // Subsequent calls should work normally
      await circuitBreaker.execute(mockFn);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should reopen circuit on failed half-open attempt', async () => {
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      const mockFn = jest.fn().mockRejectedValue(new Error('still failing'));
      
      // Half-open attempt fails
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('still failing');
      
      // Circuit should be open again
      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.OPEN);
      
      // Next call should fail immediately
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('rolling window failure tracking', () => {
    it('should only count recent failures in monitoring window', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));

      // Create a circuit breaker with very short monitoring window for testing
      const shortWindowBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        monitoringWindowMs: 100, // 100ms window
        name: 'short-window-test'
      });

      // Cause 2 failures
      await expect(shortWindowBreaker.execute(mockFn)).rejects.toThrow();
      await expect(shortWindowBreaker.execute(mockFn)).rejects.toThrow();
      
      // Wait for failures to age out
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // One more failure should not open circuit (old failures aged out)
      await expect(shortWindowBreaker.execute(mockFn)).rejects.toThrow();
      
      expect(shortWindowBreaker.getStats().state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Execute some operations
      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();

      const stats = circuitBreaker.getStats();
      
      expect(stats.state).toBe(CircuitBreakerState.CLOSED);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
      expect(stats.totalRequests).toBe(3);
      expect(stats.lastSuccessTime).toBeInstanceOf(Date);
      expect(stats.lastFailureTime).toBeInstanceOf(Date);
    });
  });

  describe('error classification', () => {
    it('should trip circuit for server errors (5xx)', () => {
      const serverError = {
        response: { status: 500 }
      };
      expect(CircuitBreaker.shouldTripCircuit(serverError)).toBe(true);
    });

    it('should trip circuit for rate limiting (429)', () => {
      const rateLimitError = {
        response: { status: 429 }
      };
      expect(CircuitBreaker.shouldTripCircuit(rateLimitError)).toBe(true);
    });

    it('should not trip circuit for client errors (4xx except 429)', () => {
      const clientError = {
        response: { status: 404 }
      };
      expect(CircuitBreaker.shouldTripCircuit(clientError)).toBe(false);
    });

    it('should trip circuit for network errors', () => {
      const networkErrors = [
        { code: 'ECONNREFUSED' },
        { code: 'ETIMEDOUT' },
        { code: 'ENOTFOUND' },
        { code: 'ECONNRESET' }
      ];

      networkErrors.forEach(error => {
        expect(CircuitBreaker.shouldTripCircuit(error)).toBe(true);
      });
    });

    it('should not trip circuit for other errors', () => {
      const otherError = new Error('validation error');
      expect(CircuitBreaker.shouldTripCircuit(otherError)).toBe(false);
    });
  });

  describe('forced state changes', () => {
    it('should allow forcing circuit to open state', () => {
      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.CLOSED);
      
      circuitBreaker.forceState(CircuitBreakerState.OPEN);
      
      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.OPEN);
      expect(circuitBreaker.getStats().nextRetryTime).toBeInstanceOf(Date);
    });

    it('should allow forcing circuit to closed state', async () => {
      // Open circuit first
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();

      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.OPEN);
      
      // Force closed
      circuitBreaker.forceState(CircuitBreakerState.CLOSED);
      
      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.CLOSED);
      
      // Should work normally again
      const successFn = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(successFn);
      expect(result).toBe('success');
    });
  });
});

describe('CircuitBreakerManager', () => {
  afterEach(() => {
    // Clean up any created breakers
    circuitBreakerManager.resetAll();
  });

  it('should create and reuse circuit breakers by name', () => {
    const breaker1 = circuitBreakerManager.getBreaker('test-service');
    const breaker2 = circuitBreakerManager.getBreaker('test-service');
    
    expect(breaker1).toBe(breaker2); // Should be same instance
  });

  it('should create different breakers for different names', () => {
    const breaker1 = circuitBreakerManager.getBreaker('service-1');
    const breaker2 = circuitBreakerManager.getBreaker('service-2');
    
    expect(breaker1).not.toBe(breaker2);
  });

  it('should allow custom configuration for new breakers', () => {
    const breaker = circuitBreakerManager.getBreaker('custom-service', {
      failureThreshold: 10,
      resetTimeoutMs: 5000
    });
    
    // We can't directly test the config, but we can test behavior
    expect(breaker).toBeInstanceOf(CircuitBreaker);
  });

  it('should collect statistics from all breakers', async () => {
    const breaker1 = circuitBreakerManager.getBreaker('service-1');
    const breaker2 = circuitBreakerManager.getBreaker('service-2');
    
    // Execute some operations to generate stats
    await breaker1.execute(() => Promise.resolve('success'));
    await expect(breaker2.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    
    const allStats = circuitBreakerManager.getAllStats();
    
    expect(allStats).toHaveProperty('service-1');
    expect(allStats).toHaveProperty('service-2');
    expect(allStats['service-1'].successCount).toBe(1);
    expect(allStats['service-2'].failureCount).toBe(1);
  });

  it('should reset all circuit breakers', async () => {
    const breaker1 = circuitBreakerManager.getBreaker('service-1');
    const breaker2 = circuitBreakerManager.getBreaker('service-2');
    
    // Force both to open state
    breaker1.forceState(CircuitBreakerState.OPEN);
    breaker2.forceState(CircuitBreakerState.OPEN);
    
    expect(breaker1.getStats().state).toBe(CircuitBreakerState.OPEN);
    expect(breaker2.getStats().state).toBe(CircuitBreakerState.OPEN);
    
    // Reset all
    circuitBreakerManager.resetAll();
    
    expect(breaker1.getStats().state).toBe(CircuitBreakerState.CLOSED);
    expect(breaker2.getStats().state).toBe(CircuitBreakerState.CLOSED);
  });
});