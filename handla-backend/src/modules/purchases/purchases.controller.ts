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

import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchasesQueryDto } from './dto/purchases-query.dto';
import { MarkPurchasePaidDto } from './dto/mark-purchase-paid.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

/**
 * PUR-1 — PurchasesController (ADMIN/EMPLOYEE only).
 */
@ApiTags('erp-purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List purchases (role-scoped, paginated)' })
  @ApiOkResponse({ description: 'Paginated purchase list' })
  async findAll(@CurrentUser() user: User, @Query() query: PurchasesQueryDto) {
    return this.purchasesService.findAll(user, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get a single purchase' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.purchasesService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a purchase (PO/bill)' })
  @ApiCreatedResponse({ description: 'Purchase created' })
  async create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: User) {
    return this.purchasesService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update a purchase (UNPAID only)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser() user: User,
  ) {
    return this.purchasesService.update(id, dto, user);
  }

  @Post(':id/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Mark a purchase PAID (auto-creates expense + ledger OUT)' })
  @ApiOkResponse({ description: 'Purchase marked paid' })
  async markAsPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPurchasePaidDto,
    @CurrentUser() user: User,
  ) {
    return this.purchasesService.markAsPaid(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a non-paid purchase (ADMIN)' })
  @ApiNoContentResponse({ description: 'Deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.purchasesService.remove(id, user);
  }
}
