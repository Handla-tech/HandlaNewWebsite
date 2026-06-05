import { useState, useEffect } from 'react';

/**
 * Debounces a value — the returned value only updates after
 * `delay` ms of inactivity.  Use this to prevent firing a new
 * API request on every keystroke in search inputs.
 *
 * @param value  The live value to debounce
 * @param delay  Debounce delay in ms (default 300)
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
