export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  /** Cancel a pending invocation, if any. */
  cancel(): void;
  /** Run a pending invocation immediately, if any. */
  flush(): void;
  /** Whether an invocation is currently scheduled. */
  pending(): boolean;
}

/**
 * Trailing-edge debounce: `fn` runs once, `delay` ms after the last call.
 * Remember to `cancel()` (or `flush()`) when the owning component is destroyed.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Args | undefined;

  const run = () => {
    timer = undefined;
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      fn(...args);
    }
  };

  const debounced = ((...args: Args) => {
    lastArgs = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, delay);
  }) as Debounced<Args>;

  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
  };

  debounced.flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      run();
    }
  };

  debounced.pending = () => timer !== undefined;

  return debounced;
}
