import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../../common/enums';

import { KnowledgeService } from './services/knowledge.service';
import { AiStateService } from './services/ai-state.service';
import {
  CreateKnowledgeDto,
  UpdateKnowledgeDto,
  KnowledgeQueryDto,
} from './dto/knowledge.dto';
import { TakeoverDto } from './dto/takeover.dto';

/**
 * Admin/staff surface for the AI assistant:
 *  - Knowledge Base CRUD
 *  - Per-conversation AI state (lead panel) + human takeover / return-to-AI
 *
 * ADMIN + EMPLOYEE only — customers never touch these routes.
 */
@ApiTags('ai')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
@Controller('ai')
export class AiController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly stateService: AiStateService,
  ) {}

  // ─── Knowledge Base CRUD ─────────────────────────────────────────────────────

  @Get('knowledge')
  @ApiOperation({ summary: 'List knowledge base entries' })
  async listKnowledge(@Query() query: KnowledgeQueryDto) {
    const data = await this.knowledgeService.findAll(query);
    return { message: 'Knowledge entries retrieved', data };
  }

  @Get('knowledge/:id')
  @ApiOperation({ summary: 'Get a single knowledge entry' })
  async getKnowledge(@Param('id', ParseUUIDPipe) id: string) {
    const entry = await this.knowledgeService.findOne(id);
    return { message: 'Knowledge entry retrieved', data: { entry } };
  }

  @Post('knowledge')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a knowledge entry (ADMIN)' })
  async createKnowledge(@Body() dto: CreateKnowledgeDto, @CurrentUser() user: User) {
    const entry = await this.knowledgeService.create(dto, user.id);
    return { message: 'Knowledge entry created', data: { entry } };
  }

  @Patch('knowledge/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a knowledge entry (ADMIN)' })
  async updateKnowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKnowledgeDto,
  ) {
    const entry = await this.knowledgeService.update(id, dto);
    return { message: 'Knowledge entry updated', data: { entry } };
  }

  @Delete('knowledge/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a knowledge entry (ADMIN)' })
  async removeKnowledge(@Param('id', ParseUUIDPipe) id: string) {
    await this.knowledgeService.remove(id);
    return { message: 'Knowledge entry deleted', data: { id } };
  }

  // ─── AI conversation state / lead panel / takeover ───────────────────────────

  @Get('conversations/:id/state')
  @ApiOperation({ summary: 'Get AI state + lead qualification for a conversation' })
  async getState(@Param('id', ParseUUIDPipe) id: string) {
    const state = await this.stateService.getOrCreate(id);
    return { message: 'AI state retrieved', data: { state } };
  }

  @Post('conversations/:id/takeover')
  @ApiOperation({ summary: 'Human takes over — the bot stops immediately' })
  async takeover(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TakeoverDto,
    @CurrentUser() user: User,
  ) {
    const state = await this.stateService.takeOver(id, user.id, dto.note);
    return { message: 'Conversation taken over by human', data: { state } };
  }

  @Post('conversations/:id/return-to-ai')
  @ApiOperation({ summary: 'Return control of the conversation to the assistant' })
  async returnToAi(@Param('id', ParseUUIDPipe) id: string) {
    const state = await this.stateService.returnToAi(id);
    return { message: 'Conversation returned to AI', data: { state } };
  }
}
