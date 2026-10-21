import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ErrorCodes,
  withRetry,
  withTimeout,
} from '../src/utils/error-handler.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';

describe('error-handler utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('withRetry retries transient failures with exponential backoff and returns success', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('temporary-1'))
      .mockRejectedValueOnce(new Error('temporary-2'))
      .mockResolvedValue('ok');

    await expect(withRetry(operation, 2, 1)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);

    const delays = timeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((delay): delay is number => typeof delay === 'number');
    expect(delays).toContain(1);
    expect(delays).toContain(2);
  });

  it('withRetry throws RETRY_EXHAUSTED when all attempts fail', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const operation = vi.fn().mockRejectedValue(new Error('permanent'));

    await expect(withRetry(operation, 2, 0)).rejects.toMatchObject({
      code: ErrorCodes.RETRY_EXHAUSTED,
    });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('withTimeout rejects with AGENT_TIMEOUT when work exceeds the limit', async () => {
    const neverFinishes = () => new Promise<string>(() => undefined);

    await expect(withTimeout(neverFinishes, 5, 'too slow')).rejects.toMatchObject({
      code: ErrorCodes.AGENT_TIMEOUT,
      message: 'too slow',
    });
  });
});

describe('RateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks another request while the request cap is full inside the 60-second window', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-10-19T00:00:00.000Z');
    vi.setSystemTime(start);

    const limiter = new RateLimiter({
      maxRequestsPerMinute: 1,
      maxTokensPerMinute: 1000,
      maxConcurrent: 5,
    });

    await limiter.acquire(100);
    expect(limiter.canProceed(100)).toBe(false);

    vi.setSystemTime(new Date(start.getTime() + 59_999));
    expect(limiter.canProceed(100)).toBe(false);

    vi.setSystemTime(new Date(start.getTime() + 60_001));
    expect(limiter.canProceed(100)).toBe(true);

    limiter.release(100);
  });
});
