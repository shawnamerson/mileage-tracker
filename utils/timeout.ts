/**
 * Timeout utility for wrapping async operations
 * Provides consistent timeout handling across the app
 */

export class TimeoutError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param operation Description of the operation for error messages
 * @returns The result of the promise, or throws TimeoutError
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`, operation));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Wrap a promise with timeout and fallback value
 * Returns the fallback if timeout occurs instead of throwing
 */
export async function withTimeoutFallback<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
  fallback: T,
  onTimeout?: (error: TimeoutError) => void
): Promise<T> {
  try {
    return await withTimeout(promise, timeoutMs, operation);
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.warn(`[Timeout] ${operation} timed out, using fallback`);
      onTimeout?.(error);
      return fallback;
    }
    throw error;
  }
}

/**
 * Common timeout durations
 */
export const TIMEOUTS = {
  QUICK: 5000,      // 5 seconds - for quick operations
  NORMAL: 15000,    // 15 seconds - for normal operations
  LONG: 30000,      // 30 seconds - for uploads/downloads
  EXTENDED: 60000,  // 60 seconds - for large data operations
} as const;
