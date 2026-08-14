import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { User } from '../auth/entities/user.entity';

import { AuthModule } from '../auth/auth.module';
import { AwsModule } from '../aws/aws.module';
import { NotificationModule } from '../notifications/notification.module';
import { EmailModule } from '../email/email.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    // Register all repositories this module needs
    TypeOrmModule.forFeature([Conversation, Message, User]),
    // AuthModule exports JwtModule (JwtService) + TypeOrmModule (UserRepo)
    AuthModule,
    // AwsModule exports AwsService, used by ChatController for presigned URLs
    AwsModule,
    // NotificationModule exports NotificationService, used by ChatGateway
    NotificationModule,
    // EmailModule exports EmailService, used by ChatGateway for async email queuing
    EmailModule,
    // AiModule exports ChatbotService — the assistant is layered on top of chat.
    forwardRef(() => AiModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
