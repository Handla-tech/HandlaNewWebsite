import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TakeoverDto {
  /** Optional note recorded when a human takes over the conversation. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  note?: string;
}

export class ReturnToAiDto {
  /**
   * When true, the assistant will post a short "back with you" system message
   * on return. Defaults to false to stay silent.
   */
  @IsOptional()
  announce?: boolean;
}
