import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
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
import { ContractsQueryDto } from './dto/contracts-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

/**
 * Nested controller: GET /api/erp/clients/:clientId/contracts
 *
 * Registered in ContractsModule (not ClientsModule) to avoid circular dependency.
 */
@ApiTags('erp-contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('erp/clients/:clientId/contracts')
export class ClientContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'List contracts for a specific client' })
  @ApiParam({ name: 'clientId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contracts for client' })
  async findByClient(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() query: ContractsQueryDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.contractsService.findAll(user, { ...query, clientId });
    return { message: 'Client contracts retrieved', data: result };
  }
}
