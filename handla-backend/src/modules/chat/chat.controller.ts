import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';

import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '../auth/entities/user.entity';
import { AwsService } from '../aws/aws.service';
import { ConversationStatus } from '../../common/enums';

@ApiTags('chat')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly awsService: AwsService,
  ) {}

  // ─── GET /api/chat/conversations ──────────────────────────────────────────────
  @Get('conversations')
  @ApiOperation({ summary: 'List conversations (admin: all, client: own)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated conversations' })
  async getConversations(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.chatService.getConversations(user, { page, limit });
    return { message: 'Conversations retrieved', data: result };
  }

  // ─── GET /api/chat/conversations/:id ─────────────────────────────────────────
  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with its full message history' })
  @ApiResponse({ status: 200, description: 'Conversation and messages' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getConversationById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const result = await this.chatService.getConversationById(id, user);
    return { message: 'Conversation retrieved', data: result };
  }

  // ─── POST /api/chat/conversations/:id/messages ───────────────────────────────
  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message to a conversation (REST fallback)' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('content') content: string,
    @Body('fileUrl') fileUrl: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { message, conversation } = await this.chatService.sendMessage(
      id,
      user,
      content,
      fileUrl,
    );

    // Broadcast to conversation room so all connected participants
    // (including the sender's other tabs) receive the real-time push.
    // This avoids the double-save bug that occurs when the frontend
    // calls both REST and sendSocketMessage independently.
    this.chatGateway.broadcastMessage(id, message);

    // Persist + push the in-app notification to the recipient's bell, and
    // queue the email. Without this call the bell only ever updated for
    // WebSocket-sent messages (file uploads) — text messages, which are
    // sent via this REST endpoint, never triggered the notification bell.
    await this.chatGateway.notifyMessageRecipient({
      conversation,
      senderUser: user,
      messageId: message.id,
      content,
    });

    // Let the AI assistant react to this message. Text messages are sent via
    // THIS REST endpoint (only file uploads use the WebSocket handler), so the
    // AI trigger must live here too — otherwise the bot never replies to normal
    // text chat. Fire-and-forget; the chatbot gates internally on
    // takeover/role/config and never blocks or breaks the chat flow.
    this.chatGateway.triggerAiReply({
      conversation,
      senderUser: user,
      message,
    });

    return { message: 'Message sent', data: { message } };
  }

  // ─── GET /api/chat/conversations/:id/messages ─────────────────────────────────
  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get all messages for a conversation' })
  @ApiResponse({ status: 200, description: 'Messages list' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getMessages(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const messages = await this.chatService.getMessages(id, user);
    return { message: 'Messages retrieved', data: messages };
  }

  // ─── POST /api/chat/conversations ─────────────────────────────────────────────
  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or return the existing conversation for the current client' })
  @ApiResponse({ status: 201, description: 'Conversation created or returned' })
  @ApiResponse({ status: 404, description: 'No admin account found' })
  async createConversation(@CurrentUser() user: User) {
    const admin = await this.chatService.findDefaultAdmin();
    if (!admin) {
      throw new NotFoundException(
        'No admin account found. Please contact support to set up your workspace.',
      );
    }
    const conversation = await this.chatService.createOrGetConversation(user.id, admin.id);
    return { message: 'Conversation ready', data: { conversation } };
  }

  // ─── POST /api/chat/presigned-url ─────────────────────────────────────────────
  @Post('presigned-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate an S3 presigned URL for direct file upload' })
  @ApiResponse({ status: 200, description: 'Presigned URL returned' })
  async getPresignedUrl(@Body() dto: PresignedUrlDto, @CurrentUser() user: User) {
    // FILE-KEY-01: sanitize the client-supplied fileName to a single flat
    // segment. Stripping only whitespace left `/` and `..` intact, so a crafted
    // name (e.g. "../victim/x.png") could steer the object outside this user's
    // `chat/<uid>/` prefix. Collapse everything that is not a safe filename char
    // so the derived key can never contain a path separator or traversal token.
    const safeName = dto.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const key = `chat/${user.id}/${Date.now()}-${safeName}`;
    const result = await this.awsService.generatePresignedUrl(key, dto.contentType);
    return {
      message: 'Presigned URL generated',
      data: result,
    };
  }

  // ─── GET /api/chat/messages/:id/file-url ─────────────────────────────────────
  //
  // PT-02: resource-based signed-download. The client passes a trusted
  // `messageId` (NOT an S3 key / not a fileUrl); the backend resolves the stored
  // key itself, verifies the requester is authorized for the message's
  // conversation, validates the key namespace, and only then signs. This closes
  // the BOLA hole where any in-bucket key could be signed for any user.
  //
  // Existing chat UX is unchanged: messages returned by the read endpoints still
  // carry a pre-signed `fileUrl`. This endpoint gives the frontend a way to
  // re-fetch a fresh short-lived URL for a specific message (e.g. after the
  // original presigned URL expires) WITHOUT ever trusting a client-supplied key.
  @Get('messages/:id/file-url')
  @ApiOperation({ summary: 'Get a fresh presigned download URL for a message attachment' })
  @ApiResponse({ status: 200, description: 'Signed URL returned' })
  @ApiResponse({ status: 404, description: 'Message or attachment not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getMessageFileUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const url = await this.chatService.getSignedFileUrlForMessage(id, user);
    return { message: 'Signed URL generated', data: { url } };
  }

  // ─── PATCH /api/chat/messages/:id/read ───────────────────────────────────────
  @Patch('messages/:id/read')
  @ApiOperation({ summary: 'Mark a specific message as read' })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async markMessageRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const message = await this.chatService.markMessageAsRead(id, user.id);
    return { message: 'Message marked as read', data: { message } };
  }

  // ─── PATCH /api/chat/conversations/:id/status ─────────────────────────────────
  @Patch('conversations/:id/status')
  @ApiOperation({ summary: 'Update conversation status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ConversationStatus,
    @CurrentUser() user: User,
  ) {
    const conversation = await this.chatService.updateStatus(id, status, user);
    return { message: 'Status updated', data: { conversation } };
  }
}
