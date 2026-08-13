import {
  IsString,
  IsOptional,
  IsEmail,
  Length,
  IsBoolean,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @Length(1, 150)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 150)
  company?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  taxId?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
