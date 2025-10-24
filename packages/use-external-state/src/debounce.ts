export interface DebounceOptions {
  wait: number;
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export interface DebouncedFunction<TArgs extends unknown[], TResult> {
  (...args: TArgs): TResult | undefined;
  cancel(): void;
  flush(): TResult | undefined;
  pending(): boolean;
}

export function createDebouncer(defaultOptions: DebounceOptions) {
  return function debounce<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult,
    override?: Partial<DebounceOptions>,
  ): DebouncedFunction<TArgs, TResult> {
    const options: DebounceOptions = {
      ...defaultOptions,
      ...override,
    };

    const wait = Math.max(0, options.wait);
    const leading = options.leading ?? false;
    const trailing = options.trailing ?? true;
    const maxWait = options.maxWait;

    let timerId: ReturnType<typeof setTimeout> | undefined;
    let lastArgs: TArgs | undefined;
    let lastCallTime: number | undefined;
    let lastInvokeTime = 0;
    let result: TResult | undefined;

    const invoke = (time: number): TResult | undefined => {
      lastInvokeTime = time;
      const args = lastArgs;
      lastArgs = undefined;
      if (!args) {
        return result;
      }
      result = fn(...args);
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

    const trailingEdge = (time: number): TResult | undefined => {
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

    const leadingEdge = (time: number): TResult | undefined => {
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

    const flush = (): TResult | undefined => {
      return timerId === undefined ? result : trailingEdge(Date.now());
    };

    const pending = (): boolean => timerId !== undefined;

    const debounced = (...args: TArgs): TResult | undefined => {
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
