/**
 * Extract a human-readable message from an axios/API error.
 * The NestJS backend returns { message: string | string[] } on failures.
 */
export function apiError(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m[0] ?? fallback;
  if (typeof m === 'string' && m.trim()) return m;
  if (typeof e?.message === 'string' && e.message.trim()) return e.message;
  return fallback;
}
