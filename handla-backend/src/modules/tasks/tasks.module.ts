import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Task } from './entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../auth/entities/user.entity';
import { TasksService } from './tasks.service';
import { TasksScheduler } from './tasks.scheduler';
import { TasksController } from './tasks.controller';
import { ProjectTasksController } from './project-tasks.controller';
import { NotificationModule } from '../notifications/notification.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Project, User]),
    NotificationModule,
    EmailModule,
  ],
  controllers: [TasksController, ProjectTasksController],
  providers: [TasksService, TasksScheduler],
  exports: [TasksService],
})
export class TasksModule {}
