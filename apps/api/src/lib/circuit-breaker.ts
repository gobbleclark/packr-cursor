import { logger } from '../utils/logger';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  resetTimeoutMs: number; // Time to wait before attempting reset
  monitoringWindowMs: number; // Rolling window for failure tracking
  name: string; // Circuit breaker identifier
}

export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, rejecting requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextRetryTime: Date | null;
  totalRequests: number;
}

/**
 * Circuit Breaker implementation for protecting against cascading failures
 * 
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Service is failing, all requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered, limited requests allowed
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextRetryTime: Date | null = null;
  private totalRequests: number = 0;
  private recentFailures: Date[] = []; // Track failures in rolling window

  constructor(private config: CircuitBreakerConfig) {
    logger.info(`Circuit breaker initialized: ${config.name}`, {
      failureThreshold: config.failureThreshold,
      resetTimeoutMs: config.resetTimeoutMs,
      monitoringWindowMs: config.monitoringWindowMs
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    
    // Check if we should allow the request
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.canAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        logger.info(`Circuit breaker transitioning to HALF_OPEN: ${this.config.name}`);
      } else {
        const error = new Error(`Circuit breaker is OPEN: ${this.config.name}`);
        (error as any).circuitBreakerOpen = true;
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = new Date();
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // If we're in half-open and got a success, close the circuit
      this.reset();
      logger.info(`Circuit breaker CLOSED after successful recovery: ${this.config.name}`);
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: any): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    // Add to recent failures tracking
    this.recentFailures.push(new Date());
    this.cleanupOldFailures();

    logger.warn(`Circuit breaker failure recorded: ${this.config.name}`, {
      error: error instanceof Error ? error.message : error,
      failureCount: this.failureCount,
      recentFailureCount: this.recentFailures.length,
      state: this.state
    });

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.openCircuit();
    }
  }

  /**
   * Determine if circuit should be opened based on failure count
   */
  private shouldOpenCircuit(): boolean {
    return this.recentFailures.length >= this.config.failureThreshold;
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextRetryTime = new Date(Date.now() + this.config.resetTimeoutMs);
    
    logger.error(`Circuit breaker OPENED: ${this.config.name}`, {
      failureCount: this.failureCount,
      recentFailureCount: this.recentFailures.length,
      nextRetryTime: this.nextRetryTime.toISOString()
    });

    // Emit metrics for monitoring
    this.emitMetrics();
  }

  /**
   * Check if we can attempt to reset (transition to HALF_OPEN)
   */
  private canAttemptReset(): boolean {
    return this.nextRetryTime !== null && new Date() >= this.nextRetryTime;
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  private reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.recentFailures = [];
    this.nextRetryTime = null;
  }

  /**
   * Clean up old failures outside the monitoring window
   */
  private cleanupOldFailures(): void {
    const cutoffTime = new Date(Date.now() - this.config.monitoringWindowMs);
    this.recentFailures = this.recentFailures.filter(time => time > cutoffTime);
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    this.cleanupOldFailures();
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.nextRetryTime,
      totalRequests: this.totalRequests
    };
  }

  /**
   * Force circuit breaker to specific state (for testing)
   */
  forceState(state: CircuitBreakerState): void {
    logger.warn(`Circuit breaker state forced: ${this.config.name}`, {
      oldState: this.state,
      newState: state
    });
    this.state = state;
    
    if (state === CircuitBreakerState.OPEN) {
      this.nextRetryTime = new Date(Date.now() + this.config.resetTimeoutMs);
    }
  }

  /**
   * Emit metrics for monitoring (placeholder for actual metrics system)
   */
  private emitMetrics(): void {
    const stats = this.getStats();
    logger.debug('Circuit breaker metrics', {
      metric: 'circuit_breaker.state_change',
      name: this.config.name,
      state: stats.state,
      failureCount: stats.failureCount,
      totalRequests: stats.totalRequests,
      tags: { circuit_breaker: this.config.name }
    });
  }

  /**
   * Check if an error should be considered a circuit breaker failure
   */
  static shouldTripCircuit(error: any): boolean {
    // Don't trip circuit for client errors (4xx), only server errors and network issues
    if (error.response) {
      const status = error.response.status;
      // Trip on server errors (5xx) and rate limiting (429)
      return status >= 500 || status === 429;
    }
    
    // Trip on network errors (no response)
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET') {
      return true;
    }
    
    // Don't trip on other errors (validation, auth, etc.)
    return false;
  }
}

/**
 * Circuit Breaker Manager for handling multiple circuit breakers
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeoutMs: 60000, // 1 minute
        monitoringWindowMs: 300000, // 5 minutes
        name,
        ...config
      };
      
      this.breakers.set(name, new CircuitBreaker(defaultConfig));
    }
    
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const [name, breaker] of this.breakers.entries()) {
      breaker.forceState(CircuitBreakerState.CLOSED);
      logger.info(`Circuit breaker reset: ${name}`);
    }
  }
}

// Global circuit breaker manager
export const circuitBreakerManager = new CircuitBreakerManager();