import { IsString, IsOptional, IsUrl, Length } from 'class-validator';

export class AttachmentDto {
  @IsUrl({ require_tld: false })
  url: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;
}
