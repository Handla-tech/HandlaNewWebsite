import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileUpload } from './entities/file-upload.entity';
import { UploadsCleanupService } from './uploads-cleanup.service';
import { AwsModule } from '../aws/aws.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileUpload]),
    AwsModule,
  ],
  providers: [UploadsCleanupService],
  exports: [UploadsCleanupService, TypeOrmModule],
})
export class UploadsModule {}
