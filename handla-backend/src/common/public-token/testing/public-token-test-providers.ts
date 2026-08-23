import { ConfigService } from '@nestjs/config';
import { PublicTokenService } from '../public-token.service';

/**
 * INFO-01 — shared test providers for the invoice / quotation / contract
 * service specs that inject `PublicTokenService` + `ConfigService` after the
 * public-link hardening.
 *
 * `PublicTokenService` is stateless/pure (it mutates entities passed in), so we
 * provide the REAL implementation. `ConfigService` is mocked with the INFO-01
 * config namespace (legacy links ON by default, no default expiry, and a fixed
 * frontend base URL) so the specs get deterministic behaviour without loading
 * the whole config module.
 */
export function makePublicTokenTestProviders(
  overrides: Partial<Record<string, unknown>> = {},
) {
  const values: Record<string, unknown> = {
    'publicDoc.legacyIdLinks': true,
    'publicDoc.defaultExpiryDays': 0,
    'auth.frontendUrl': 'https://handla.tech',
    ...overrides,
  };

  const configService = {
    get: jest.fn((key: string) => values[key]),
    // Allow tests to flip flags at runtime (e.g. legacy disable tests).
    __set: (key: string, value: unknown) => {
      values[key] = value;
    },
  };

  return [
    PublicTokenService,
    { provide: ConfigService, useValue: configService },
  ];
}
