export interface RateLimiterConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxConcurrent: number;
}

export const DEFAULT_RATE_LIMITS: RateLimiterConfig = {
  maxRequestsPerMinute: 50,
  maxTokensPerMinute: 100000,
  maxConcurrent: 5,
};

interface RequestRecord {
  timestamp: number;
  tokens: number;
}

const WINDOW_MS = 60_000;
const WAIT_BUFFER_MS = 100;
const MAX_RATE_WAIT_SLICE_MS = 5_000;

export class RateLimiter {
  private config: RateLimiterConfig;
  private requestHistory: RequestRecord[] = [];
  private activeRequests = 0;
  private waitQueue: Array<() => void> = [];

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITS, ...config };

    if (
      this.config.maxRequestsPerMinute <= 0 ||
      this.config.maxTokensPerMinute <= 0 ||
      this.config.maxConcurrent <= 0
    ) {
      throw new Error('Rate limiter values must be greater than zero');
    }
  }

  async acquire(estimatedTokens: number = 1000): Promise<void> {
    if (estimatedTokens < 0 || !Number.isFinite(estimatedTokens)) {
      throw new Error('estimatedTokens must be a non-negative finite number');
    }
    if (estimatedTokens > this.config.maxTokensPerMinute) {
      throw new Error(
        'estimatedTokens exceeds maxTokensPerMinute and can never be scheduled',
      );
    }

    // Reserve concurrency after a slot is available. Incrementing here avoids
    // multiple awakened callers all observing the same free slot.
    while (this.activeRequests >= this.config.maxConcurrent) {
      await this.waitForSlot();
    }
    this.activeRequests += 1;

    try {
      await this.waitForRateLimit(estimatedTokens);
      this.requestHistory.push({
        timestamp: Date.now(),
        tokens: estimatedTokens,
      });
    } catch (error) {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      const next = this.waitQueue.shift();
      if (next) next();
      throw error;
    }
  }

  release(actualTokens?: number): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    if (actualTokens !== undefined && this.requestHistory.length > 0) {
      const lastRequest = this.requestHistory.at(-1);
      if (lastRequest !== undefined) {
        lastRequest.tokens = actualTokens;
      }
    }

    const next = this.waitQueue.shift();
    if (next) next();
  }

  getStatus(): {
    activeRequests: number;
    requestsInWindow: number;
    tokensInWindow: number;
    availableRequests: number;
    availableTokens: number;
  } {
    this.pruneOldRecords();
    const requestsInWindow = this.requestHistory.length;
    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0,
    );
    return {
      activeRequests: this.activeRequests,
      requestsInWindow,
      tokensInWindow,
      availableRequests: Math.max(
        0,
        this.config.maxRequestsPerMinute - requestsInWindow,
      ),
      availableTokens: Math.max(
        0,
        this.config.maxTokensPerMinute - tokensInWindow,
      ),
    };
  }

  canProceed(estimatedTokens: number = 1000): boolean {
    this.pruneOldRecords();
    const requestsInWindow = this.requestHistory.length;
    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0,
    );

    return (
      this.activeRequests < this.config.maxConcurrent &&
      requestsInWindow < this.config.maxRequestsPerMinute &&
      tokensInWindow + estimatedTokens <= this.config.maxTokensPerMinute
    );
  }

  private async waitForSlot(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  private async waitForRateLimit(estimatedTokens: number): Promise<void> {
    // acquire() has already reserved this caller's concurrency slot, so this
    // helper evaluates only the sliding-window request/token budgets.
    while (true) {
      this.pruneOldRecords();

      const requestsInWindow = this.requestHistory.length;
      const tokensInWindow = this.requestHistory.reduce(
        (sum, record) => sum + record.tokens,
        0,
      );
      const rateLimitAvailable =
        requestsInWindow < this.config.maxRequestsPerMinute &&
        tokensInWindow + estimatedTokens <= this.config.maxTokensPerMinute;

      if (rateLimitAvailable) return;
      if (this.requestHistory.length === 0) return;

      const oldestRequest = this.requestHistory[0];
      if (oldestRequest === undefined) return;

      const expiration = oldestRequest.timestamp + WINDOW_MS;
      const waitUntilExpiry = expiration - Date.now() + WAIT_BUFFER_MS;
      const waitMs = Math.min(
        MAX_RATE_WAIT_SLICE_MS,
        Math.max(WAIT_BUFFER_MS, waitUntilExpiry),
      );

      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private pruneOldRecords(): void {
    const cutoff = Date.now() - WINDOW_MS;
    this.requestHistory = this.requestHistory.filter(
      (record) => record.timestamp > cutoff,
    );
  }
}

export async function withRateLimit<T>(
  rateLimiter: RateLimiter,
  fn: () => Promise<T>,
  estimatedTokens: number = 1000,
): Promise<T> {
  await rateLimiter.acquire(estimatedTokens);
  try {
    return await fn();
  } finally {
    rateLimiter.release();
  }
}

export const globalRateLimiter = new RateLimiter();
