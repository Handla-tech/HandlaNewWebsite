import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WebsiteProject } from './entities/website-project.entity';
import { WebsiteProduct } from './entities/website-product.entity';
import { WebsiteProjectController } from './website-project.controller';
import { WebsiteProductController } from './website-product.controller';
import { WebsiteProjectService } from './website-project.service';
import { WebsiteProductService } from './website-product.service';
import { AwsModule } from '../aws/aws.module';

/**
 * WebsiteModule — the "Website Content" umbrella.
 *
 * Groups public marketing content managed by admins:
 *   • Website Projects (portfolio / case studies)  → /api/website/projects
 *   • Website Products (ready-made solutions)       → /api/website/products
 *
 * Testimonials remain in their own standalone TestimonialModule
 * (/api/testimonials) but are conceptually part of the same
 * "Website Content" section in the ERP admin UI.
 *
 * ⚠️  Website Projects are NOT related to ERP `Project`s (modules/projects).
 */
@Module({
  imports: [TypeOrmModule.forFeature([WebsiteProject, WebsiteProduct]), AwsModule],
  controllers: [WebsiteProjectController, WebsiteProductController],
  providers: [WebsiteProjectService, WebsiteProductService],
  exports: [WebsiteProjectService, WebsiteProductService],
})
export class WebsiteModule {}
