import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { FileUpload, FileUploadStatus } from './entities/file-upload.entity';
import { AwsService } from '../aws/aws.service';

@Injectable()
export class UploadsCleanupService {
  private readonly logger = new Logger(UploadsCleanupService.name);

  constructor(
    @InjectRepository(FileUpload)
    private readonly fileUploadRepo: Repository<FileUpload>,
    private readonly awsService: AwsService,
  ) {}

  /**
   * Cleanup abandoned / orphaned uploads:
   * Finds uploads that have been in 'PENDING' status for longer than `maxAgeHours` (default: 24h),
   * deletes them safely from S3, and marks the DB record as 'EXPIRED'.
   *
   * Crucial safety guarantees:
   * - NEVER deletes objects in 'CONSUMED' status (active task attachments, invoice proofs).
   * - NEVER runs a blanket S3 prefix deletion.
   * - Deletes each confirmed abandoned file individually with error isolation and logging.
   */
  async cleanupOrphanedUploads(maxAgeHours = 24): Promise<{ cleaned: number; failed: number }> {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const abandoned = await this.fileUploadRepo.find({
      where: {
        status: FileUploadStatus.PENDING,
        createdAt: LessThan(cutoff),
      },
      take: 100, // Batch limit to avoid long-running locks or timeouts
    });

    if (abandoned.length === 0) {
      return { cleaned: 0, failed: 0 };
    }

    let cleaned = 0;
    let failed = 0;

    for (const record of abandoned) {
      try {
        await this.awsService.deleteFile(record.s3Key);
        record.status = FileUploadStatus.EXPIRED;
        await this.fileUploadRepo.save(record);
        cleaned++;
        this.logger.log(`Cleaned up abandoned upload: key=${record.s3Key} id=${record.id}`);
      } catch (err) {
        failed++;
        this.logger.error(`Failed to clean up upload: key=${record.s3Key} id=${record.id}`, (err as Error).stack);
      }
    }

    this.logger.log(`Uploads cleanup run finished: cleaned=${cleaned}, failed=${failed}`);
    return { cleaned, failed };
  }
}
