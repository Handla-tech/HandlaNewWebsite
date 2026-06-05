import { IsUUID, IsBoolean } from 'class-validator';

export class TypingDto {
  @IsUUID()
  conversationId: string;

  @IsBoolean()
  isTyping: boolean;
}
