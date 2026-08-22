import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
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
      // AWS SDK v3 (>= 3.729) defaults requestChecksumCalculation to
      // 'WHEN_SUPPORTED', which bakes x-amz-checksum-crc32 +
      // x-amz-sdk-checksum-algorithm into PRESIGNED PutObject URLs. Browsers
      // uploading the raw file via a plain PUT do not (re)send that exact
      // checksum header, so S3 rejects the upload with SignatureDoesNotMatch /
      // a failed CORS preflight. Forcing 'WHEN_REQUIRED' keeps checksums out of
      // presigned URLs so direct browser uploads work.
      requestChecksumCalculation: 'WHEN_REQUIRED',
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
  /**
   * @param publicRead Marks the upload as a PUBLIC website asset (project /
   *   product cover images) that the marketing site renders directly in an
   *   <img> via its plain S3 URL. Public reachability is granted by a BUCKET
   *   POLICY on the public prefix (e.g. `handla/website/*`) — NOT by an object
   *   ACL — so this works with modern buckets that have ACLs disabled
   *   ("Bucket owner enforced"). No `x-amz-acl` header is sent, so the browser
   *   PUT must NOT send one either. Defaults to false (private object; served
   *   later via a short-lived presigned GET URL).
   *
   *   Required one-time bucket policy for public website assets:
   *     {
   *       "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
   *       "Resource": "arn:aws:s3:::<bucket>/<prefix>/website/*"
   *     }
   */
  async generatePresignedUrl(
    key: string,
    contentType: string,
    expiresInOverride?: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    publicRead = false,
  ): Promise<PresignedUrlResult> {
    const expiry = expiresInOverride ?? this.expiresIn;
    const physicalKey = this.withPrefix(key);

    // NOTE: intentionally NO `ACL` — public access is granted by a bucket
    // policy on the public prefix, so uploads succeed on ACL-disabled buckets.
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

  // ─── Generate Presigned DOWNLOAD (GET) URL ───────────────────────────────────
  /**
   * The bucket is PRIVATE, so a plain object URL returns AccessDenied. To let a
   * browser view/download an object we must hand it a short-lived presigned GET
   * URL (signature in the query string). Callers pass the logical key.
   */
  async generateGetUrl(key: string, expiresInOverride?: number): Promise<string> {
    const expiry = expiresInOverride ?? this.expiresIn;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.withPrefix(key),
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiry });
  }

  /**
   * Convert a stored value (either a full plain S3 URL or a bare key) into a
   * presigned GET URL. Returns the input unchanged if it is null/empty or is
   * not an object in THIS bucket (e.g. an external URL). Never throws — on any
   * failure it falls back to the original value so message rendering can't break.
   */
  async signFileUrl(fileUrlOrKey: string | null | undefined, expiresInOverride?: number): Promise<string | null> {
    if (!fileUrlOrKey) return fileUrlOrKey ?? null;
    // Already a presigned URL? Leave it alone.
    if (fileUrlOrKey.includes('X-Amz-Signature=')) return fileUrlOrKey;

    try {
      let logicalKey: string | null = null;
      if (/^https?:\/\//i.test(fileUrlOrKey)) {
        // Full S3 URL → extract the logical key (returns null if not our bucket).
        logicalKey = this.getKeyFromUrl(fileUrlOrKey);
        if (!logicalKey) return fileUrlOrKey; // external URL — pass through
      } else {
        // Bare key.
        logicalKey = fileUrlOrKey;
      }
      return await this.generateGetUrl(logicalKey, expiresInOverride);
    } catch (err) {
      this.logger.warn(`signFileUrl failed for "${fileUrlOrKey}" — returning original`, err as Error);
      return fileUrlOrKey;
    }
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
