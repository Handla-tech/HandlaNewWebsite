import { PartialType } from '@nestjs/swagger';
import { CreateTestimonialDto } from './create-testimonial.dto';

// All fields from CreateTestimonialDto become optional.
// class-validator decorators are inherited and still run when a field is present.
export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {}
