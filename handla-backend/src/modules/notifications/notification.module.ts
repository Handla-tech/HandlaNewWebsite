import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';
import { Notification } from './entities/notification.entity';
import { PushToken } from './entities/push-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, PushToken])],
  controllers: [NotificationController],
  providers: [NotificationService, PushService],
  // Export services so ChatGateway / other modules can create notifications
  // and (optionally) send pushes directly.
  exports: [NotificationService, PushService],
})
export class NotificationModule {}
