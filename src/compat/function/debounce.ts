interface DebounceOptions {
  /**
   * An optional AbortSignal to cancel the debounced function.
   */
  signal?: AbortSignal;

  /**
   * If `true`, the function will be invoked on the leading edge of the timeout.
   * @default false
   */
  leading?: boolean;

  /**
   * If `true`, the function will be invoked on the trailing edge of the timeout.
   * @default true
   */
  trailing?: boolean;

  /**
   * The maximum time `func` is allowed to be delayed before it's invoked.
   * @default Infinity
   */
  maxWait?: number;
}

/**
 * Creates a debounced function that delays invoking the provided function until after `debounceMs` milliseconds
 * have elapsed since the last time the debounced function was invoked. The debounced function also has a `cancel`
 * method to cancel any pending execution.
 *
 * You can set the debounced function to run at the start (`leading`) or end (`trailing`) of the delay period.
 * If `leading` is true, the function runs immediately on the first call.
 * If `trailing` is true, the function runs after `debounceMs` milliseconds have passed since the last call.
 * If both `leading` and `trailing` are true, the function runs at both the start and end, but it must be called at least twice within `debounceMs` milliseconds for this to happen
 * (since one debounced function call cannot trigger the function twice).
 *
 * You can also set a `maxWait` time, which is the maximum time the function is allowed to be delayed before it is called.
 *
 * @template F - The type of function.
 * @param {F} func - The function to debounce.
 * @param {number} debounceMs - The number of milliseconds to delay.
 * @param {DebounceOptions} options - The options object
 * @param {AbortSignal} options.signal - An optional AbortSignal to cancel the debounced function.
 * @param {boolean} options.leading - If `true`, the function will be invoked on the leading edge of the timeout.
 * @param {boolean} options.trailing - If `true`, the function will be invoked on the trailing edge of the timeout.
 * @param {number} options.maxWait - The maximum time `func` is allowed to be delayed before it's invoked.
 * @returns A new debounced function with a `cancel` method.
 *
 * @example
 * const debouncedFunction = debounce(() => {
 *   console.log('Function executed');
 * }, 1000);
 *
 * // Will log 'Function executed' after 1 second if not called again in that time
 * debouncedFunction();
 *
 * // Will not log anything as the previous call is canceled
 * debouncedFunction.cancel();
 *
 * // With AbortSignal
 * const controller = new AbortController();
 * const signal = controller.signal;
 * const debouncedWithSignal = debounce(() => {
 *  console.log('Function executed');
 * }, 1000, { signal });
 *
 * debouncedWithSignal();
 *
 * // Will cancel the debounced function call
 * controller.abort();
 */
export function debounce<F extends (...args: any[]) => any>(
  func: F,
  debounceMs: number = 0,
  options: DebounceOptions = {}
): ((...args: Parameters<F>) => ReturnType<F> | undefined) & {
  cancel: () => void;
  flush: () => void;
} {
  if (typeof options !== 'object') {
    options = {};
  }

  const { signal, leading = false, trailing = true, maxWait } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingAt: number | null = null;

  let result: ReturnType<F> | undefined = undefined;
  let pendingArgs: Parameters<F> | null = null;

  const cancel = () => {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    pendingArgs = null;
    pendingAt = null;
  };

  const flush = function (this: any) {
    if (pendingArgs != null) {
      result = func.apply(this, pendingArgs);
    }
    cancel();
    return result;
  };

  const debounced = function (this: any, ...args: Parameters<F>): ReturnType<F> | undefined {
    if (signal?.aborted) {
      return;
    }

    const timer = () => {
      timeoutId = null;

      if (trailing && pendingArgs != null) {
        result = func.apply(this, pendingArgs);
      }

      cancel();
    };

    pendingArgs = args;

    if (maxWait != null) {
      if (pendingAt != null) {
        if (Date.now() - pendingAt >= maxWait) {
          result = func.apply(this, args);
          pendingArgs = null;

          pendingAt = Date.now();
        }
      } else {
        pendingAt = Date.now();
      }
    }

    const isFirstCall = timeoutId == null;

    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(timer, debounceMs);

    if (leading && isFirstCall) {
      result = func.apply(this, args);
      pendingArgs = null;
    }

    return result;
  };

  const onAbort = cancel;

  debounced.cancel = cancel;
  debounced.flush = flush;

  signal?.addEventListener('abort', onAbort, { once: true });

  return debounced;
}
