import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedUrlResult {
  url: string;
  bucket: string;
  key: string;
  expiresIn: number;
  fileUrl: string;
}

@Injectable()
export class AwsService {
  private readonly logger = new Logger(AwsService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly expiresIn: number;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('aws.region') || 'us-east-1';
    this.bucket = this.configService.get<string>('aws.s3Bucket') || 'handla-uploads';
    this.expiresIn = this.configService.get<number>('aws.presignedUrlExpiry') || 900;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId') || '',
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey') || '',
      },
    });
  }

  // ─── Generate Presigned Upload URL ───────────────────────────────────────────
  async generatePresignedUrl(
    key: string,
    contentType: string,
    expiresInOverride?: number,
  ): Promise<PresignedUrlResult> {
    const expiry = expiresInOverride ?? this.expiresIn;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiry });

    const fileUrl = this.buildFileUrl(key);

    this.logger.log(`Presigned URL generated for key: ${key} (expires in ${expiry}s)`);

    return { url, bucket: this.bucket, key, expiresIn: expiry, fileUrl };
  }

  // ─── Delete File ─────────────────────────────────────────────────────────────
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.s3Client.send(command);
    this.logger.log(`File deleted from S3: ${key}`);
  }

  // ─── Copy File ───────────────────────────────────────────────────────────────
  async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    });
    await this.s3Client.send(command);
    this.logger.log(`File copied: ${sourceKey} → ${destinationKey}`);
    return this.buildFileUrl(destinationKey);
  }

  // ─── Check File Exists ───────────────────────────────────────────────────────
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Build the public HTTPS URL for an S3 object key */
  buildFileUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /** Extract the S3 key from a full S3 HTTPS URL */
  getKeyFromUrl(fileUrl: string): string | null {
    const prefix = `https://${this.bucket}.s3.${this.region}.amazonaws.com/`;
    if (fileUrl.startsWith(prefix)) {
      return fileUrl.slice(prefix.length);
    }
    return null;
  }

  // ─── Upload Buffer ───────────────────────────────────────────────────────────
  /**
   * Upload an in-memory Buffer directly to S3.
   * Used by ContractsService to store generated HTML documents.
   */
  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    const fileUrl = this.buildFileUrl(key);
    this.logger.log(`Buffer uploaded to S3: key=${key} (${buffer.length} bytes)`);
    return fileUrl;
  }
}
