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
  /**
   * Optional top-level folder every object is stored under (e.g. "handla").
   * Callers pass logical keys ("chat/…", "contracts/…"); the physical S3 key
   * is `${keyPrefix}/${logicalKey}`. Empty string = no prefix (root), which
   * preserves the historical layout so existing objects keep resolving.
   */
  private readonly keyPrefix: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('aws.region') || 'us-east-1';
    this.bucket = this.configService.get<string>('aws.s3Bucket') || 'handla-uploads';
    this.expiresIn = this.configService.get<number>('aws.presignedUrlExpiry') || 900;
    // Normalise: trim, drop leading/trailing slashes → "handla" or "".
    this.keyPrefix = (this.configService.get<string>('aws.keyPrefix') || '')
      .trim()
      .replace(/^\/+|\/+$/g, '');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId') || '',
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey') || '',
      },
    });
  }

  /**
   * Map a logical key to the physical S3 key by applying the configured
   * prefix. Idempotent: a key that already begins with the prefix is left
   * untouched (so re-processing a stored physical key is safe).
   */
  private withPrefix(logicalKey: string): string {
    const clean = logicalKey.replace(/^\/+/, '');
    if (!this.keyPrefix) return clean;
    if (clean === this.keyPrefix || clean.startsWith(`${this.keyPrefix}/`)) {
      return clean;
    }
    return `${this.keyPrefix}/${clean}`;
  }

  // ─── Generate Presigned Upload URL ───────────────────────────────────────────
  async generatePresignedUrl(
    key: string,
    contentType: string,
    expiresInOverride?: number,
  ): Promise<PresignedUrlResult> {
    const expiry = expiresInOverride ?? this.expiresIn;
    const physicalKey = this.withPrefix(key);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: physicalKey,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiry });

    const fileUrl = this.buildFileUrl(key);

    this.logger.log(`Presigned URL generated for key: ${physicalKey} (expires in ${expiry}s)`);

    return { url, bucket: this.bucket, key: physicalKey, expiresIn: expiry, fileUrl };
  }

  // ─── Delete File ─────────────────────────────────────────────────────────────
  async deleteFile(key: string): Promise<void> {
    const physicalKey = this.withPrefix(key);
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: physicalKey });
    await this.s3Client.send(command);
    this.logger.log(`File deleted from S3: ${physicalKey}`);
  }

  // ─── Copy File ───────────────────────────────────────────────────────────────
  async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    const src = this.withPrefix(sourceKey);
    const dest = this.withPrefix(destinationKey);
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${src}`,
      Key: dest,
    });
    await this.s3Client.send(command);
    this.logger.log(`File copied: ${src} → ${dest}`);
    return this.buildFileUrl(destinationKey);
  }

  // ─── Check File Exists ───────────────────────────────────────────────────────
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.withPrefix(key) }),
      );
      return true;
    } catch {
      return false;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Build the public HTTPS URL for a logical S3 object key (prefix applied). */
  buildFileUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${this.withPrefix(key)}`;
  }

  /**
   * Extract the logical S3 key from a full S3 HTTPS URL. The configured prefix
   * is stripped so the returned key round-trips back through withPrefix().
   */
  getKeyFromUrl(fileUrl: string): string | null {
    const urlPrefix = `https://${this.bucket}.s3.${this.region}.amazonaws.com/`;
    if (!fileUrl.startsWith(urlPrefix)) return null;
    const physicalKey = fileUrl.slice(urlPrefix.length);
    if (this.keyPrefix && physicalKey.startsWith(`${this.keyPrefix}/`)) {
      return physicalKey.slice(this.keyPrefix.length + 1);
    }
    return physicalKey;
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
    const physicalKey = this.withPrefix(key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: physicalKey,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    const fileUrl = this.buildFileUrl(key);
    this.logger.log(`Buffer uploaded to S3: key=${physicalKey} (${buffer.length} bytes)`);
    return fileUrl;
  }
}
