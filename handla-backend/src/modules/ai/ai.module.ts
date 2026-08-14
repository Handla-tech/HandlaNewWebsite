import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiController } from './ai.controller';
import { KnowledgeEntry } from './entities/knowledge-entry.entity';
import { ConversationAiState } from './entities/conversation-ai-state.entity';
import { Message } from '../chat/entities/message.entity';
import { User } from '../auth/entities/user.entity';

import { AiService } from './services/ai.service';
import { PromptService } from './services/prompt.service';
import { KnowledgeService } from './services/knowledge.service';
import { ConversationContextService } from './services/conversation-context.service';
import { LeadExtractionService } from './services/lead-extraction.service';
import { AiStateService } from './services/ai-state.service';
import { ChatbotService } from './services/chatbot.service';

import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';

/**
 * AI-1: Handla AI Assistant.
 *
 * Layered ON TOP of ChatModule — it reuses ChatService.saveMessage and the
 * gateway's broadcast helpers instead of introducing a parallel messaging
 * system. ChatModule imports AiModule (forwardRef) to invoke the orchestrator.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeEntry, ConversationAiState, Message, User]),
    AuthModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [AiController],
  providers: [
    AiService,
    PromptService,
    KnowledgeService,
    ConversationContextService,
    LeadExtractionService,
    AiStateService,
    ChatbotService,
  ],
  exports: [ChatbotService, AiStateService, KnowledgeService],
})
export class AiModule {}
