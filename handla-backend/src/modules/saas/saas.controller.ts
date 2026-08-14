import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiCookieAuth, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../../common/enums';

import { ProductsService } from './services/products.service';
import { PlansService } from './services/plans.service';
import { TenantsService } from './services/tenants.service';
import { LeadConversionService } from './services/lead-conversion.service';

import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import {
  CreateTenantDto,
  TenantsQueryDto,
  ChangePlanDto,
  TenantActionDto,
} from './dto/tenant.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';

/**
 * SAAS-1 — Admin surface for the SaaS Control Plane.
 *
 * Handla is a MANAGED control plane: provisioning is ADMIN-only, with NO
 * public self-service. Every route below is gated to ADMIN via @Roles + the
 * global RolesGuard (re-applied here explicitly for clarity/defence-in-depth).
 *
 * Responses use the standard `{ message, data }` envelope.
 */
@ApiTags('saas')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('saas')
export class SaasController {
  constructor(
    private readonly products: ProductsService,
    private readonly plans: PlansService,
    private readonly tenants: TenantsService,
    private readonly leadConversion: LeadConversionService,
  ) {}

  // ─── Products ──────────────────────────────────────────────────────────────
  @Get('products')
  @ApiOperation({ summary: 'List managed products (ADMIN)' })
  async listProducts() {
    const products = await this.products.findAll();
    return { message: 'Products retrieved', data: { products } };
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product (ADMIN)' })
  async getProduct(@Param('id', ParseUUIDPipe) id: string) {
    const product = await this.products.findOne(id);
    return { message: 'Product retrieved', data: { product } };
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a managed product (ADMIN)' })
  async createProduct(@Body() dto: CreateProductDto) {
    const product = await this.products.create(dto);
    return { message: 'Product created', data: { product } };
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a product (ADMIN)' })
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.products.update(id, dto);
    return { message: 'Product updated', data: { product } };
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product (ADMIN)' })
  async deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    await this.products.remove(id);
  }

  // ─── Plans (scoped to a product) ─────────────────────────────────────────────
  @Get('products/:productId/plans')
  @ApiOperation({ summary: 'List a product’s plans (ADMIN)' })
  async listPlans(@Param('productId', ParseUUIDPipe) productId: string) {
    const plans = await this.plans.findAllForProduct(productId);
    return { message: 'Plans retrieved', data: { plans } };
  }

  @Post('products/:productId/plans')
  @ApiOperation({ summary: 'Create a plan for a product (ADMIN)' })
  async createPlan(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreatePlanDto,
  ) {
    const plan = await this.plans.create(productId, dto);
    return { message: 'Plan created', data: { plan } };
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get a plan (ADMIN)' })
  async getPlan(@Param('id', ParseUUIDPipe) id: string) {
    const plan = await this.plans.findOne(id);
    return { message: 'Plan retrieved', data: { plan } };
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Update a plan (ADMIN)' })
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    const plan = await this.plans.update(id, dto);
    return { message: 'Plan updated', data: { plan } };
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a plan (ADMIN)' })
  async deletePlan(@Param('id', ParseUUIDPipe) id: string) {
    await this.plans.remove(id);
  }

  // ─── Tenants ──────────────────────────────────────────────────────────────
  @Get('tenants')
  @ApiOperation({ summary: 'List tenants (ADMIN, paginated)' })
  async listTenants(@Query() query: TenantsQueryDto) {
    const data = await this.tenants.findAll(query);
    return { message: 'Tenants retrieved', data };
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get a tenant with subscription + logs (ADMIN)' })
  async getTenant(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.tenants.getDetail(id);
    return { message: 'Tenant retrieved', data };
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Provision a tenant for a client (ADMIN)' })
  async createTenant(@Body() dto: CreateTenantDto, @CurrentUser() user: User) {
    const tenant = await this.tenants.create(dto, user.id);
    return { message: 'Tenant queued for provisioning', data: { tenant } };
  }

  @Post('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspend a tenant (non-destructive) (ADMIN)' })
  async suspendTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: TenantActionDto,
    @CurrentUser() user: User,
  ) {
    const tenant = await this.tenants.suspend(id, user.id);
    return { message: 'Tenant suspension queued', data: { tenant } };
  }

  @Post('tenants/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended tenant (ADMIN)' })
  async reactivateTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: TenantActionDto,
    @CurrentUser() user: User,
  ) {
    const tenant = await this.tenants.reactivate(id, user.id);
    return { message: 'Tenant reactivation queued', data: { tenant } };
  }

  @Post('tenants/:id/archive')
  @ApiOperation({ summary: 'Archive a tenant (retention) (ADMIN)' })
  async archiveTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: TenantActionDto,
    @CurrentUser() user: User,
  ) {
    const tenant = await this.tenants.archive(id, user.id);
    return { message: 'Tenant archival queued', data: { tenant } };
  }

  @Post('tenants/:id/retry')
  @ApiOperation({ summary: 'Retry provisioning for a FAILED tenant (ADMIN)' })
  async retryTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const tenant = await this.tenants.retry(id, user.id);
    return { message: 'Tenant provisioning re-queued', data: { tenant } };
  }

  @Post('tenants/:id/change-plan')
  @ApiOperation({ summary: 'Change a tenant’s plan (ADMIN)' })
  async changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePlanDto,
    @CurrentUser() user: User,
  ) {
    const tenant = await this.tenants.changePlan(id, dto, user.id);
    return { message: 'Plan change queued', data: { tenant } };
  }

  // ─── Lead → Client → Tenant conversion ────────────────────────────────────────
  @Post('convert-lead')
  @ApiOperation({
    summary: 'Convert a qualified AI lead into a Client + provisioned Tenant (ADMIN)',
  })
  async convertLead(@Body() dto: ConvertLeadDto, @CurrentUser() user: User) {
    const data = await this.leadConversion.convert(dto, user.id);
    return { message: 'Lead converted and tenant queued', data };
  }
}
