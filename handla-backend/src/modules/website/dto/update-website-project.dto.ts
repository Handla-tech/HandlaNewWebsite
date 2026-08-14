import { PartialType } from '@nestjs/swagger';
import { CreateWebsiteProjectDto } from './create-website-project.dto';

// All fields optional; class-validator decorators still run when a field is present.
export class UpdateWebsiteProjectDto extends PartialType(CreateWebsiteProjectDto) {}
