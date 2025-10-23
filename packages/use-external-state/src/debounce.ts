export interface DebounceOptions {
  wait: number;
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  cancel(): void;
  flush(): ReturnType<T> | undefined;
  pending(): boolean;
}

export function createDebouncer(defaultOptions: DebounceOptions) {
  return function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    override?: Partial<DebounceOptions>,
  ): DebouncedFunction<T> {
    const options: DebounceOptions = {
      ...defaultOptions,
      ...override,
    };

    const wait = Math.max(0, options.wait);
    const leading = options.leading ?? false;
    const trailing = options.trailing ?? true;
    const maxWait = options.maxWait;

    let timerId: ReturnType<typeof setTimeout> | undefined;
    let lastArgs: Parameters<T> | undefined;
    let lastCallTime: number | undefined;
    let lastInvokeTime = 0;
    let result: ReturnType<T> | undefined;

    const invoke = (time: number): ReturnType<T> | undefined => {
      lastInvokeTime = time;
      const args = lastArgs;
      lastArgs = undefined;
      if (!args) {
        return result;
      }
      result = fn(...args) as ReturnType<T>;
      return result;
    };

    const startTimer = (pending: number) => {
      timerId = setTimeout(timerExpired, pending);
    };

    const shouldInvoke = (time: number): boolean => {
      if (lastCallTime === undefined) {
        return true;
      }
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;

      if (timeSinceLastCall >= wait) {
        return true;
      }
      if (timeSinceLastCall < 0) {
        return true;
      }
      if (typeof maxWait === 'number' && timeSinceLastInvoke >= maxWait) {
        return true;
      }
      return false;
    };

    const remainingWait = (time: number): number => {
      if (lastCallTime === undefined) {
        return wait;
      }
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;
      const timeWaiting = wait - timeSinceLastCall;
      return typeof maxWait === 'number'
        ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
        : timeWaiting;
    };

    const trailingEdge = (time: number): ReturnType<T> | undefined => {
      timerId = undefined;
      if (trailing && lastArgs) {
        return invoke(time);
      }
      lastArgs = undefined;
      return result;
    };

    const timerExpired = () => {
      const time = Date.now();
      if (shouldInvoke(time)) {
        return trailingEdge(time);
      }
      const pending = remainingWait(time);
      startTimer(pending);
      return undefined;
    };

    const leadingEdge = (time: number): ReturnType<T> | undefined => {
      lastInvokeTime = time;
      startTimer(wait);
      if (leading) {
        return invoke(time);
      }
      return result;
    };

    const cancel = () => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      timerId = undefined;
      lastArgs = undefined;
      lastCallTime = undefined;
      lastInvokeTime = 0;
    };

    const flush = (): ReturnType<T> | undefined => {
      return timerId === undefined ? result : trailingEdge(Date.now());
    };

    const pending = (): boolean => timerId !== undefined;

    const debounced = (...args: Parameters<T>): ReturnType<T> | undefined => {
      const time = Date.now();
      const isInvoking = shouldInvoke(time);

      lastArgs = args;
      lastCallTime = time;

      if (isInvoking) {
        if (timerId === undefined) {
          return leadingEdge(lastCallTime);
        }
        if (typeof maxWait === 'number') {
          clearTimeout(timerId);
          startTimer(wait);
          return invoke(lastCallTime);
        }
      }

      if (timerId === undefined) {
        startTimer(wait);
      }

      return result;
    };

    debounced.cancel = cancel;
    debounced.flush = flush;
    debounced.pending = pending;

    return debounced;
  };
}
