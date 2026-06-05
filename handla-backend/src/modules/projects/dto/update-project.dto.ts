import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';

/**
 * ERP-4 — UpdateProjectDto
 *
 * All fields from CreateProjectDto are optional (PartialType).
 * `clientId` is included so that ADMIN can move a project to another client.
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
