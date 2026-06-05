import { PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';

/**
 * All fields from CreateTaskDto are optional for partial updates.
 * Note: projectId can technically be provided here but will be rejected
 * for non-ADMIN users (service enforces this).
 */
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
