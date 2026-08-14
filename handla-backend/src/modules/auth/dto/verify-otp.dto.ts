import { IsEmail, IsString, Length, Matches, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: '483921' })
  @IsString()
  @Length(6, 6, { message: 'The verification code must be 6 digits' })
  @Matches(/^\d{6}$/, { message: 'The verification code must be 6 digits' })
  code: string;

  @ApiProperty({ enum: ['SIGNUP', 'LOGIN', 'GOOGLE'], example: 'SIGNUP' })
  @IsIn(['SIGNUP', 'LOGIN', 'GOOGLE'], { message: 'Invalid verification purpose' })
  purpose: 'SIGNUP' | 'LOGIN' | 'GOOGLE';
}

export class ResendOtpDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ enum: ['SIGNUP', 'LOGIN', 'GOOGLE'], example: 'SIGNUP' })
  @IsIn(['SIGNUP', 'LOGIN', 'GOOGLE'], { message: 'Invalid verification purpose' })
  purpose: 'SIGNUP' | 'LOGIN' | 'GOOGLE';
}
