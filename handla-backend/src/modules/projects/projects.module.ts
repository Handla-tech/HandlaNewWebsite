import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from './entities/project.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../auth/entities/user.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ClientProjectsController } from './client-projects.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Client, User, Conversation]),
    ChatModule,
  ],
  controllers: [ProjectsController, ClientProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
