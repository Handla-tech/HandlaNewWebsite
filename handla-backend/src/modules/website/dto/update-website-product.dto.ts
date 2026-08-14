import { PartialType } from '@nestjs/swagger';
import { CreateWebsiteProductDto } from './create-website-product.dto';

// All fields optional; class-validator decorators still run when a field is present.
export class UpdateWebsiteProductDto extends PartialType(CreateWebsiteProductDto) {}
