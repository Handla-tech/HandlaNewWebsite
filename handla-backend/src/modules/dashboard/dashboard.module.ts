import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User }     from '../auth/entities/user.entity';
import { Client }   from '../clients/entities/client.entity';
import { Project }  from '../projects/entities/project.entity';
import { Task }     from '../tasks/entities/task.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Invoice }  from '../invoices/entities/invoice.entity';
import { Expense }  from '../expenses/entities/expense.entity';

import { DashboardService }    from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Client,
      Project,
      Task,
      Contract,
      Invoice,
      Expense,
    ]),
  ],
  controllers: [DashboardController],
  providers:   [DashboardService],
})
export class DashboardModule {}
