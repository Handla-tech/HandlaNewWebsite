/**
 * XSS-01 — Safe serialization of JSON for embedding inside an HTML
 * <script type="application/ld+json"> element.
 *
 * Escapes the characters that would otherwise let a string value break OUT of
 * the <script> block or start a rogue tag. Even though today's callers pass
 * only static, locale-parameterised schema data, this makes <JsonLd>
 * safe-by-construction should a future caller ever pass user-influenced content
 * (e.g. a product name loaded from the DB). Standard hardening for JSON in HTML.
 *
 *   <  → \u003c   (prevents "</script>" breakout and new tags)
 *   >  → \u003e
 *   &  → \u0026
 *   U+2028 / U+2029 → escaped (valid JSON, but terminate an inline <script>)
 *
 * The browser JSON parser decodes these escapes back to the original
 * characters, so the structured data is unchanged for search engines.
 */
export function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
