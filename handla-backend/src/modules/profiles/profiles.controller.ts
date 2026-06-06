import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

import { ProfilesService } from './profiles.service';
import { AwsService } from '../aws/aws.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AvatarUploadDto } from './dto/avatar-upload.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '../auth/entities/user.entity';

/**
 * Profiles module — per-user profile CRUD.
 *
 * Route map:
 *   GET    /profiles/me                  any authenticated user — own profile
 *   PATCH  /profiles/me                  any authenticated user — update own profile
 *   POST   /profiles/me/avatar-upload    any authenticated user — presigned S3 URL
 *   GET    /profiles/:id                 owner OR ADMIN
 *   PATCH  /profiles/:id                 owner OR ADMIN
 *
 * IMPORTANT — route ordering:
 *   The literal /me, /me/avatar-upload routes MUST be declared BEFORE
 *   /:id (and /:id/...) so that NestJS does not interpret "me" as a UUID
 *   and feed it to ParseUUIDPipe. Same reason as the
 *   NotificationController / ExpensesController route ordering — see
 *   tests/profiles.controller.spec.ts for the regression guard.
 */
@ApiTags('profiles')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly aws: AwsService,
  ) {}

  // ─── GET /profiles/me ─────────────────────────────────────────────────────
  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user\u2019s own profile' })
  @ApiResponse({ status: 200, description: 'Profile of the current user' })
  async getMe(@CurrentUser() user: User) {
    const profile = await this.profiles.getMe(user.id);
    return { message: 'Profile retrieved', data: { profile } };
  }

  // ─── PATCH /profiles/me ───────────────────────────────────────────────────
  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user\u2019s own profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const profile = await this.profiles.update(user.id, dto);
    return { message: 'Profile updated', data: { profile } };
  }

  // ─── POST /profiles/me/avatar-upload ───────────────────────────────────────
  @Post('me/avatar-upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a presigned S3 URL for uploading a profile picture',
  })
  @ApiBody({ type: AvatarUploadDto })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL + final fileUrl to PATCH back to /profiles/me',
  })
  async getAvatarUploadUrl(@CurrentUser() user: User, @Body() dto: AvatarUploadDto) {
    // Per-user prefix so one user cannot overwrite another\u2019s avatar.
    // Timestamp prevents browser/CDN caching from showing the old image
    // after a new upload.
    const safeName = dto.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const key = `avatars/${user.id}/${Date.now()}-${safeName}`;
    const result = await this.aws.generatePresignedUrl(key, dto.contentType);
    return { message: 'Avatar upload URL generated', data: result };
  }

  // ─── GET /profiles/:id ────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get a profile by user id (owner OR ADMIN)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Profile retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    this.profiles.assertSelfOrAdmin(user, id);
    const profile = await this.profiles.findById(id);
    return { message: 'Profile retrieved', data: { profile } };
  }

  // ─── PATCH /profiles/:id ──────────────────────────────────────────────────
  @Patch(':id')
  @ApiOperation({ summary: 'Update a profile by user id (owner OR ADMIN)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: User,
  ) {
    this.profiles.assertSelfOrAdmin(user, id);
    const profile = await this.profiles.update(id, dto);
    return { message: 'Profile updated', data: { profile } };
  }
}
