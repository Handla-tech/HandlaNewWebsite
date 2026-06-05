import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractsQueryDto } from './dto/contracts-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('erp-contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('erp/contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  // ── GET /erp/contracts ──────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'List all contracts (role-scoped)' })
  @ApiResponse({ status: 200, description: 'Paginated contracts list' })
  async findAll(
    @Query() query: ContractsQueryDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.contractsService.findAll(user, query);
    return { message: 'Contracts retrieved', data: result };
  }

  // ── GET /erp/contracts/:id ──────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get a single contract by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract found' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.findOne(id, user);
    return { message: 'Contract retrieved', data: { contract } };
  }

  // ── POST /erp/contracts ─────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a new DRAFT contract' })
  @ApiResponse({ status: 201, description: 'Contract created' })
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.create(dto, user);
    return { message: 'Contract created', data: { contract } };
  }

  // ── PATCH /erp/contracts/:id ────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Update a DRAFT contract (title/body only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.update(id, dto, user);
    return { message: 'Contract updated', data: { contract } };
  }

  // ── DELETE /erp/contracts/:id ───────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a DRAFT contract (ADMIN only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Contract deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.contractsService.remove(id, user);
  }

  // ── POST /erp/contracts/:id/send ────────────────────────────────────────
  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Send a DRAFT contract to the client (DRAFT → SENT)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract sent to client' })
  async sendToClient(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.sendToClient(id, user);
    return { message: 'Contract sent to client', data: { contract } };
  }

  // ── POST /erp/contracts/:id/accept ──────────────────────────────────────
  @Post(':id/accept')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Accept (sign) a contract — CLIENT only (SENT → SIGNED)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract signed' })
  async acceptContract(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.acceptContract(id, user);
    return { message: 'Contract accepted and signed', data: { contract } };
  }

  // ── POST /erp/contracts/:id/reject ──────────────────────────────────────
  @Post(':id/reject')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Reject a contract — CLIENT only (SENT → REJECTED)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract rejected' })
  async rejectContract(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.rejectContract(id, user);
    return { message: 'Contract rejected', data: { contract } };
  }

  // ── GET /erp/contracts/:id/pdf-url ──────────────────────────────────────
  @Get(':id/pdf-url')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get a presigned URL for the contract HTML document' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Presigned URL returned' })
  async getPdfUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const url = await this.contractsService.getPdfSignedUrl(id, user);
    return { message: 'Document URL retrieved', data: { url } };
  }
}
