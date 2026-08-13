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

import { AccountingService } from './accounting.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

/**
 * ACC-1 — AccountingController
 *
 * All routes are ADMIN/EMPLOYEE only (back-office finance).
 *
 * Route order matters: static segments (/accounts, /ledger, /clients) are
 * declared before any `:id` param routes to avoid UUID-parse collisions.
 */
@ApiTags('erp-accounting')
@ApiBearerAuth()
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // Chart of Accounts
  // ══════════════════════════════════════════════════════════════════════════

  @Get('accounts')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List chart of accounts' })
  @ApiOkResponse({ description: 'Accounts' })
  async listAccounts(@Query('includeInactive') includeInactive?: string) {
    return this.accountingService.findAllAccounts(includeInactive === 'true');
  }

  @Get('accounts/:id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get a single account' })
  async getAccount(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountingService.findAccount(id);
  }

  @Get('accounts/:id/balance')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get an account balance (net IN-OUT), grouped by currency' })
  async getAccountBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.accountingService.getAccountBalance(id, { from, to });
  }

  @Post('accounts')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create an account' })
  @ApiCreatedResponse({ description: 'Account created' })
  async createAccount(@Body() dto: CreateAccountDto) {
    return this.accountingService.createAccount(dto);
  }

  @Patch('accounts/:id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update an account' })
  async updateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountingService.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a non-system, unused account (ADMIN)' })
  @ApiNoContentResponse({ description: 'Deleted' })
  async removeAccount(@Param('id', ParseUUIDPipe) id: string) {
    await this.accountingService.removeAccount(id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // General Ledger
  // ══════════════════════════════════════════════════════════════════════════

  @Get('ledger')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Query the general ledger (filters + pagination)' })
  @ApiOkResponse({ description: 'Paginated ledger entries' })
  async getLedger(@Query() query: LedgerQueryDto) {
    return this.accountingService.findLedger(query);
  }

  @Post('ledger')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a manual ledger entry' })
  @ApiCreatedResponse({ description: 'Entry created' })
  async createManualEntry(
    @Body() dto: CreateLedgerEntryDto,
    @CurrentUser() user: User,
  ) {
    return this.accountingService.createManualEntry(dto, user);
  }

  @Delete('ledger/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a manual ledger entry (ADMIN)' })
  @ApiNoContentResponse({ description: 'Deleted' })
  async removeManualEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.accountingService.removeManualEntry(id, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Per-client ledger / statement
  // ══════════════════════════════════════════════════════════════════════════

  @Get('clients/:clientId/ledger')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get a client statement (chronological + running balance)' })
  @ApiOkResponse({ description: 'Client ledger' })
  async getClientLedger(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.accountingService.getClientLedger(clientId);
  }
}
