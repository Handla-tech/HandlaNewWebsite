/**
 * ── SSRF guard for outbound server-side requests ────────────────────────────
 *
 * Any URL that Handla fetches server-side (currently only the SaaS product
 * provisioning base URL, which is ADMIN-configured) must pass through here
 * FIRST. This is defence-in-depth: even a compromised ADMIN session cannot
 * turn the provisioner into a Server-Side Request Forgery primitive against
 * cloud metadata (169.254.169.254), the loopback interface, link-local, or
 * RFC-1918 private ranges.
 *
 * Design notes / limitations (documented honestly):
 *   • This is a SYNTACTIC / literal-IP guard. It blocks the obvious internal
 *     targets and non-http(s) schemes. It does NOT resolve DNS, so a hostname
 *     that resolves to a private IP (DNS-rebinding) is not caught here — that
 *     residual risk is accepted for an ADMIN-only, timeout-bounded, one-shot
 *     provisioning call and is noted in SECURITY.md (SSRF-01).
 *   • An optional allow-list (SAAS_PROVISION_HOST_ALLOWLIST) can pin outbound
 *     provisioning to known product hosts, which removes the residual risk
 *     entirely when configured.
 */

const BLOCKED_SCHEMES = new Set([
  'file:',
  'ftp:',
  'gopher:',
  'data:',
  'dict:',
  'ldap:',
  'tftp:',
  'ssh:',
  'ws:',
  'wss:',
]);

/** Literal IPv4 in a private / loopback / link-local / reserved range. */
function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return true; // malformed → treat as unsafe
  const [a, b] = o;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16 (AWS/GCP metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast / reserved 224.0.0.0+
  return false;
}

/** Loopback / unspecified / link-local / unique-local IPv6 literal. */
function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::1' || h === '::') return true; // loopback / unspecified
  if (h.startsWith('fe80')) return true; // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique-local fc00::/7
  // IPv4-mapped IPv6 in DOTTED form (::ffff:169.254.169.254)
  const mappedDotted = /::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mappedDotted && isPrivateIpv4(mappedDotted[1])) return true;
  // IPv4-mapped IPv6 in HEX form — the WHATWG URL parser normalises
  // ::ffff:169.254.169.254 → ::ffff:a9fe:a9fe. Decode the trailing two hextets
  // back to dotted IPv4 and re-check.
  const mappedHex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    if (isPrivateIpv4(dotted)) return true;
  }
  return false;
}

/** Hostnames that resolve to the local host without being IP literals. */
function isLocalHostname(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'localhost' ||
    h === 'localhost.localdomain' ||
    h.endsWith('.localhost') ||
    h === 'metadata.google.internal' || // GCP metadata
    h.endsWith('.internal') ||
    h.endsWith('.local')
  );
}

export interface SafeUrlOptions {
  /** Optional exact-host allow-list. When non-empty, the host MUST be in it. */
  allowlist?: string[];
  /** Permit private/loopback targets (dev/test only). Default false. */
  allowPrivate?: boolean;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/**
 * Validate that `rawUrl` is a safe outbound target. Throws UnsafeUrlError on
 * any http(s) URL that points at an internal/private/loopback resource or a
 * disallowed scheme. Returns the parsed URL on success.
 */
export function assertSafeOutboundUrl(rawUrl: string, opts: SafeUrlOptions = {}): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Malformed URL');
  }

  const scheme = url.protocol.toLowerCase();
  if (scheme !== 'http:' && scheme !== 'https:') {
    throw new UnsafeUrlError(`Blocked scheme: ${url.protocol}`);
  }
  if (BLOCKED_SCHEMES.has(scheme)) {
    throw new UnsafeUrlError(`Blocked scheme: ${url.protocol}`);
  }

  // Credentials in the authority (http://user:pass@host) are a common SSRF /
  // parser-confusion trick — reject them outright.
  if (url.username || url.password) {
    throw new UnsafeUrlError('Credentials are not allowed in outbound URLs');
  }

  const host = url.hostname;

  if (opts.allowlist && opts.allowlist.length > 0) {
    if (!opts.allowlist.map((h) => h.toLowerCase()).includes(host.toLowerCase())) {
      throw new UnsafeUrlError(`Host not in allow-list: ${host}`);
    }
    return url; // allow-list is authoritative
  }

  if (opts.allowPrivate) return url;

  if (isLocalHostname(host) || isPrivateIpv4(host) || isPrivateIpv6(host)) {
    throw new UnsafeUrlError(`Blocked internal/private target: ${host}`);
  }

  return url;
}

/** Boolean convenience wrapper. */
export function isSafeOutboundUrl(rawUrl: string, opts: SafeUrlOptions = {}): boolean {
  try {
    assertSafeOutboundUrl(rawUrl, opts);
    return true;
  } catch {
    return false;
  }
}
