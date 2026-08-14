import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterPushTokenDto {
  @ApiProperty({ description: 'Expo push token, e.g. ExponentPushToken[xxxx]' })
  @IsString()
  @MaxLength(255)
  token: string;

  @ApiPropertyOptional({ description: "Device platform: 'ios' | 'android' | 'web'" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;

  @ApiPropertyOptional({ description: 'Human-readable device name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export class UnregisterPushTokenDto {
  @ApiProperty({ description: 'Expo push token to remove' })
  @IsString()
  @MaxLength(255)
  token: string;
}
