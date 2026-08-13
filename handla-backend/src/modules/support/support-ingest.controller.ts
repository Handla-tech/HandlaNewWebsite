import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';

import { SupportService } from './support.service';
import { IngestTicketDto } from './dto/ingest-ticket.dto';
import { IngestReplyDto } from './dto/ingest-reply.dto';
import { ApiKeyGuard, ApiKeyClient } from './guards/api-key.guard';
import { ClientApiKey } from './entities/client-api-key.entity';

/**
 * SUP-2 — SupportIngestController (/api/support)
 *
 * Programmatic ticket ingest for external platforms, authenticated with a
 * per-client API key (Authorization: Bearer <key>  OR  X-Api-Key: <key>).
 * NOT behind the JWT guard — access is scoped entirely to the key's client.
 */
@ApiTags('support-ingest')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('api/support')
export class SupportIngestController {
  constructor(private readonly supportService: SupportService) {}

  // ── POST /api/support/tickets ─────────────────────────────────────────
  @Post('tickets')
  @ApiOperation({ summary: 'Open a support ticket via client API key' })
  @ApiResponse({ status: 201, description: 'Ticket created (sanitized)' })
  @ApiResponse({ status: 401, description: 'Missing/invalid API key' })
  async createTicket(
    @ApiKeyClient() apiKey: ClientApiKey,
    @Body() dto: IngestTicketDto,
  ) {
    return this.supportService.ingestTicket(apiKey, dto);
  }

  // ── POST /api/support/tickets/:id/replies ─────────────────────────────
  @Post('tickets/:id/replies')
  @ApiOperation({ summary: 'Reply to one of the client\u2019s tickets via API key' })
  @ApiResponse({ status: 201, description: 'Reply added (sanitized ticket)' })
  @ApiResponse({ status: 403, description: 'Ticket not owned by this client' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async addReply(
    @ApiKeyClient() apiKey: ClientApiKey,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IngestReplyDto,
  ) {
    return this.supportService.ingestReply(apiKey, id, dto);
  }

  // ── GET /api/support/ping ─────────────────────────────────────────────
  @Get('ping')
  @ApiOperation({ summary: 'Validate an API key (returns the bound clientId)' })
  @ApiResponse({ status: 200, description: 'Key is valid' })
  async ping(@ApiKeyClient() apiKey: ClientApiKey) {
    return { ok: true, clientId: apiKey.clientId, label: apiKey.label };
  }
}
