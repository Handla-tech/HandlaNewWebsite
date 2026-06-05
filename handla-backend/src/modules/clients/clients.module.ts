import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from './entities/client.entity';
import { User } from '../auth/entities/user.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { NotificationModule } from '../notifications/notification.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, User]),
    NotificationModule,
    EmailModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService], // UsersModule needs this for promoteLeadToClient()
})
export class ClientsModule {}
