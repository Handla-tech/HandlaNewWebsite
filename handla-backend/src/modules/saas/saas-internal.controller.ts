import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';

import { Public } from '../../common/guards/jwt.guard';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';
import { TenantsService } from './services/tenants.service';
import { ProvisioningCallbackDto } from './dto/tenant.dto';

/**
 * SAAS-1 — INBOUND service-to-service surface.
 *
 * Products (Mudar / Matjari / Manara) call back here to report the outcome of
 * an asynchronous provisioning job. These routes are @Public() (they bypass the
 * global JWT/cookie auth because callers are servers, not logged-in users) but
 * are protected instead by the shared-secret InternalApiKeyGuard.
 *
 * This is the ONLY externally-reachable write path that is not ADMIN-gated, and
 * it can only move a job forward via a requestId that Handla itself minted —
 * it can neither create tenants nor bypass the state machine.
 */
@ApiTags('saas-internal')
@ApiSecurity('internal-api-key')
@Public()
@UseGuards(InternalApiKeyGuard)
@Controller('internal/tenants')
export class SaasInternalController {
  constructor(private readonly tenants: TenantsService) {}

  /**
   * Product → Handla provisioning callback.
   * Idempotent: keyed on the `requestId` Handla generated for the job; unknown
   * or already-finished jobs are handled gracefully by the service.
   */
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Provisioning status callback (product → Handla)' })
  async callback(@Body() dto: ProvisioningCallbackDto) {
    const result = await this.tenants.handleCallback(dto);
    return { message: 'Callback processed', data: result };
  }
}
