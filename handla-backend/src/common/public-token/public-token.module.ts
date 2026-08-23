import { Global, Module } from '@nestjs/common';
import { PublicTokenService } from './public-token.service';

/**
 * INFO-01 — PublicTokenModule.
 *
 * Provides the shared, document-type-agnostic public capability-token service
 * (generation, rotation, revocation, expiry, and centralized validation) to the
 * invoice / quotation / contract modules.
 *
 * Marked @Global because the service holds no per-request or per-entity state
 * (it operates on entities passed in by the caller) and is consumed by several
 * unrelated feature modules; a global singleton avoids threading the import
 * through each module while keeping a single validation choke-point.
 */
@Global()
@Module({
  providers: [PublicTokenService],
  exports: [PublicTokenService],
})
export class PublicTokenModule {}
