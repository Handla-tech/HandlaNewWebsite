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
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';

import { WebsiteProjectService } from './website-project.service';
import { CreateWebsiteProjectDto } from './dto/create-website-project.dto';
import { UpdateWebsiteProjectDto } from './dto/update-website-project.dto';
import { WebsiteProjectQueryDto } from './dto/website-project-query.dto';
import { JwtAuthGuard, Public } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';
import { AwsService } from '../aws/aws.service';

@ApiTags('website-content')
@Controller('website/projects')
export class WebsiteProjectController {
  constructor(
    private readonly service: WebsiteProjectService,
    private readonly awsService: AwsService,
  ) {}

  // ─── POST /api/website/projects/image-upload  (ADMIN only) ───────────────────
  // Backend-controlled multipart upload for website project/product cover image.
  // Validates file buffer magic bytes, strict MIME types (JPEG, PNG, WebP, GIF - no SVG),
  // maximum file size (5MB), and uploads directly to S3 under `website/projects/*`.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('image-upload')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    }),
  )
  @ApiOperation({ summary: 'Upload a website image with byte validation (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Website image uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file or unsupported image format' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File is required and cannot be empty');
    }

    const MAX_WEBSITE_IMAGE_SIZE = 5 * 1024 * 1024;
    if (file.buffer.length > MAX_WEBSITE_IMAGE_SIZE) {
      throw new BadRequestException('File size exceeds the 5MB limit');
    }

    // Inspect actual file bytes / magic numbers
    const fileType = await import('file-type');
    const fromBuffer = fileType.fromBuffer ?? (fileType.default as any)?.fromBuffer;
    const detected = await fromBuffer(file.buffer);

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!detected || !allowedMimes.includes(detected.mime)) {
      throw new BadRequestException(
        'Invalid or unsupported image type. Only JPEG, PNG, WEBP, and GIF are allowed.',
      );
    }

    // Extract and validate client-supplied original filename extension
    const originalName = file.originalname || '';
    const lastDotIndex = originalName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      throw new BadRequestException('File must have a valid image extension (.jpg, .jpeg, .png, .webp, or .gif)');
    }
    const rawExt = originalName.substring(lastDotIndex + 1).toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!allowedExtensions.includes(rawExt)) {
      throw new BadRequestException(
        `Unsupported file extension '.${rawExt}'. Only .jpg, .jpeg, .png, .webp, and .gif are permitted.`,
      );
    }

    // Verify consistency between declared MIME type and detected MIME type
    if (file.mimetype) {
      const declaredMime = file.mimetype.toLowerCase().trim();
      if (declaredMime !== detected.mime) {
        throw new BadRequestException(
          `Declared MIME type (${declaredMime}) does not match detected image format (${detected.mime}).`,
        );
      }
    }

    // Verify consistency between original extension and detected format (accounting for jpg/jpeg aliases)
    const isJpegExt = rawExt === 'jpg' || rawExt === 'jpeg';
    const isJpegDetected = detected.mime === 'image/jpeg';
    if (isJpegDetected && !isJpegExt) {
      throw new BadRequestException(`File extension '.${rawExt}' is incompatible with detected JPEG image format.`);
    }
    if (!isJpegDetected) {
      const expectedExt = detected.ext.toLowerCase();
      if (rawExt !== expectedExt) {
        throw new BadRequestException(
          `File extension '.${rawExt}' is incompatible with detected ${expectedExt.toUpperCase()} image format.`,
        );
      }
    }

    // Canonical extension based on detected magic bytes (canonical 'jpg' for image/jpeg)
    const canonicalExt = detected.mime === 'image/jpeg' ? 'jpg' : detected.ext.toLowerCase();
    const key = `website/projects/${Date.now()}-${randomUUID()}.${canonicalExt}`;

    const fileUrl = await this.awsService.uploadBuffer(file.buffer, key, detected.mime);

    return {
      message: 'Website image uploaded successfully',
      data: {
        fileUrl,
        key,
        contentType: detected.mime,
        size: file.buffer.length,
      },
    };
  }

  // ─── GET /api/website/projects  (PUBLIC) ─────────────────────────────────────
  @Public()
  @Get()
  @ApiOperation({ summary: 'List website portfolio projects (public, paginated, featured filter)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated website projects' })
  async findAll(@Query() query: WebsiteProjectQueryDto) {
    const result = await this.service.findAll(query);
    return { message: 'Website projects retrieved', data: result };
  }

  // ─── GET /api/website/projects/:id  (PUBLIC) ─────────────────────────────────
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single website project by ID (public)' })
  @ApiResponse({ status: 200, description: 'Website project found' })
  @ApiResponse({ status: 404, description: 'Website project not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const project = await this.service.findOne(id);
    return { message: 'Website project retrieved', data: { project } };
  }

  // ─── POST /api/website/projects  (ADMIN only) ────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create a website project (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Website project created' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async create(@Body() dto: CreateWebsiteProjectDto, @CurrentUser() user: User) {
    const project = await this.service.create(dto, user.id);
    return { message: 'Website project created', data: { project } };
  }

  // ─── PATCH /api/website/projects/:id  (ADMIN only) ───────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update a website project (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Website project updated' })
  @ApiResponse({ status: 404, description: 'Website project not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWebsiteProjectDto) {
    const project = await this.service.update(id, dto);
    return { message: 'Website project updated', data: { project } };
  }

  // ─── DELETE /api/website/projects/:id  (ADMIN only) ──────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete a website project (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Website project deleted' })
  @ApiResponse({ status: 404, description: 'Website project not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
    return { message: 'Website project deleted' };
  }
}
