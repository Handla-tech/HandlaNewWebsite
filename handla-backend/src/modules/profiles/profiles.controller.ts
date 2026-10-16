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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
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
    summary: 'Upload a profile picture directly',
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiResponse({
    status: 200,
    description: 'Avatar uploaded and profile updated',
  })
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File is required and cannot be empty');
    }

    const fileType = await import('file-type');
    const fromBuffer = fileType.fromBuffer ?? (fileType.default as any)?.fromBuffer;
    const detected = await fromBuffer(file.buffer);

    if (!detected || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(detected.mime)) {
      throw new BadRequestException('Invalid or unsupported image type. Only JPEG, PNG, WEBP, and GIF are allowed.');
    }

    const key = `avatars/${user.id}/${Date.now()}-${randomUUID()}.${detected.ext}`;
    const fileUrl = await this.aws.uploadBuffer(file.buffer, key, detected.mime);

    const oldAvatarUrl = user.avatarUrl;

    let profile;
    try {
      profile = await this.profiles.setAvatarUrl(user.id, fileUrl);
    } catch (dbErr) {
      this.aws.deleteFile(key).catch(err => {
        Logger.warn(`Failed to clean up newly uploaded avatar ${key} after DB failure`, err);
      });
      throw dbErr;
    }

    if (oldAvatarUrl) {
      const logicalKey = this.aws.resolveLogicalKey(oldAvatarUrl);
      if (this.aws.isKeyInNamespace(logicalKey, [`avatars/${user.id}/`])) {
        this.aws.deleteFile(logicalKey).catch(err => {
          Logger.warn(`Failed to delete old avatar ${logicalKey}`, err);
        });
      }
    }

    return { message: 'Profile picture updated', data: { profile } };
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
