import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

/**
 * All fields from CreateClientDto are optional for an update.
 * `userId` is omitted — you cannot re-point a Client to a different User.
 */
export class UpdateClientDto extends PartialType(OmitType(CreateClientDto, ['userId'] as const)) {}
