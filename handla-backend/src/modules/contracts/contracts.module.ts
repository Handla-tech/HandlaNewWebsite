import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { ClientContractsController } from './client-contracts.controller';

import { Contract } from './entities/contract.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../auth/entities/user.entity';
import { Conversation } from '../chat/entities/conversation.entity';

import { AwsModule } from '../aws/aws.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationModule } from '../notifications/notification.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, Client, User, Conversation]),
    AwsModule,
    ChatModule,
    NotificationModule,
    EmailModule,
  ],
  controllers: [ContractsController, ClientContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
