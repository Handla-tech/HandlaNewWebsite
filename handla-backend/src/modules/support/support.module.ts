import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Ticket } from './entities/ticket.entity';
import { TicketReply } from './entities/ticket-reply.entity';
import { ClientApiKey } from './entities/client-api-key.entity';
import { Client } from '../clients/entities/client.entity';
import { Project } from '../projects/entities/project.entity';

import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportIngestController } from './support-ingest.controller';
import { ApiKeyGuard } from './guards/api-key.guard';

import { NotificationModule } from '../notifications/notification.module';

/**
 * SUP — SupportModule
 *
 * Ticketing tied to Client + optional Project with threaded replies, simple
 * priority-based SLA windows, and per-client API keys for programmatic ingest
 * (/api/support, guarded by ApiKeyGuard). No circular dependencies.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketReply, ClientApiKey, Client, Project]),
    NotificationModule,
  ],
  controllers: [SupportController, SupportIngestController],
  providers: [SupportService, ApiKeyGuard],
  exports: [SupportService],
})
export class SupportModule {}
