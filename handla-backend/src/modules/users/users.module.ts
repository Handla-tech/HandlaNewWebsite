import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../auth/entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EmailModule } from '../email/email.module';
import { ClientsModule } from '../clients/clients.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    EmailModule,
    NotificationModule,
    forwardRef(() => ClientsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // other ERP modules (Clients, Projects…) can inject it
})
export class UsersModule {}
