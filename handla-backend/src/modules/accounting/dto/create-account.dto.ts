import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  IsBoolean,
} from 'class-validator';
import { AccountType } from '../../../common/enums';

export class CreateAccountDto {
  @IsString()
  @Length(1, 20)
  code: string;

  @IsString()
  @Length(1, 120)
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
