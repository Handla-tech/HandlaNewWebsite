import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';

import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

/**
 * ERP-8 — ExpensesController
 *
 * NOTE: /summary must be declared before /:id so NestJS doesn't interpret
 * the literal string "summary" as a UUID and reject it.
 *
 * Endpoints:
 *   GET    /erp/expenses/summary     ADMIN, EMPLOYEE — financial summary
 *   GET    /erp/expenses             ADMIN, EMPLOYEE — paginated list
 *   GET    /erp/expenses/:id         ADMIN, EMPLOYEE — single entry
 *   POST   /erp/expenses             ADMIN, EMPLOYEE — create manual entry
 *   PATCH  /erp/expenses/:id         ADMIN, EMPLOYEE — update (manual only)
 *   DELETE /erp/expenses/:id         ADMIN           — delete (manual only)
 */
@ApiTags('erp-expenses')
@ApiBearerAuth()
@Controller('erp/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // ─── GET /erp/expenses/summary ────────────────────────────────────────────
  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get financial summary (income/expenses/net/outstanding)' })
  @ApiOkResponse({ description: 'Financial summary for the given period' })
  async getFinancialSummary(
    @CurrentUser() user: User,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?: string,
  ) {
    return this.expensesService.getFinancialSummary(user, dateFrom, dateTo);
  }

  // ─── GET /erp/expenses ────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List expenses/income entries (role-scoped, paginated)' })
  @ApiOkResponse({ description: 'Paginated expense list' })
  async findAll(@CurrentUser() user: User, @Query() query: ExpensesQueryDto) {
    return this.expensesService.findAll(user, query);
  }

  // ─── GET /erp/expenses/:id ────────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get a single expense/income entry' })
  @ApiOkResponse({ description: 'Expense entry' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.expensesService.findOne(id, user);
  }

  // ─── POST /erp/expenses ───────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a manual income/expense entry' })
  @ApiCreatedResponse({ description: 'Entry created' })
  async create(@Body() dto: CreateExpenseDto, @CurrentUser() user: User) {
    return this.expensesService.create(dto, user);
  }

  // ─── PATCH /erp/expenses/:id ──────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @ApiOperation({ summary: 'Update a manual expense entry (auto-entries are read-only)' })
  @ApiOkResponse({ description: 'Updated entry' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: User,
  ) {
    return this.expensesService.update(id, dto, user);
  }

  // ─── DELETE /erp/expenses/:id ─────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a manual expense entry (ADMIN, auto-entries blocked)' })
  @ApiNoContentResponse({ description: 'Deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.expensesService.remove(id, user);
  }
}
