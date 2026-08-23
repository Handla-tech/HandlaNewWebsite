import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// ─── Mock AWS SDK before imports ─────────────────────────────────────────────

const mockS3Send = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  CopyObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  HeadObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// Import AFTER mocks
import { AwsService } from '../aws.service';

// ─── Config mock ─────────────────────────────────────────────────────────────

const configValues: Record<string, string | number> = {
  'aws.region': 'us-east-1',
  'aws.s3Bucket': 'handla-uploads',
  'aws.presignedUrlExpiry': 900,
  'aws.accessKeyId': 'FAKE_ACCESS_KEY',
  'aws.secretAccessKey': 'FAKE_SECRET_KEY',
};

const mockConfigService = {
  get: jest.fn((key: string) => configValues[key]),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AwsService', () => {
  let service: AwsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AwsService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<AwsService>(AwsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── generatePresignedUrl ──────────────────────────────────────────────────

  describe('generatePresignedUrl', () => {
    it('should return a presigned URL result with correct shape', async () => {
      const fakeSignedUrl =
        'https://handla-uploads.s3.us-east-1.amazonaws.com/uploads/test.jpg?X-Amz-Signature=abc';
      mockGetSignedUrl.mockResolvedValue(fakeSignedUrl);

      const result = await service.generatePresignedUrl('uploads/test.jpg', 'image/jpeg');

      expect(result).toEqual({
        url: fakeSignedUrl,
        bucket: 'handla-uploads',
        key: 'uploads/test.jpg',
        expiresIn: 900,
        fileUrl: 'https://handla-uploads.s3.us-east-1.amazonaws.com/uploads/test.jpg',
      });
    });

    it('should use expiresInOverride when provided', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

      const result = await service.generatePresignedUrl('uploads/doc.pdf', 'application/pdf', 300);

      expect(result.expiresIn).toBe(300);
      // Verify getSignedUrl was called with the overridden expiry
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 300,
      });
    });

    it('should default to 900s expiry when no override', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

      await service.generatePresignedUrl('key.txt', 'text/plain');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 900,
      });
    });
  });

  // ─── deleteFile ───────────────────────────────────────────────────────────

  describe('deleteFile', () => {
    it('should call S3 DeleteObjectCommand with correct bucket and key', async () => {
      mockS3Send.mockResolvedValue({});

      await service.deleteFile('uploads/to-delete.jpg');

      expect(mockS3Send).toHaveBeenCalledTimes(1);

      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'handla-uploads',
        Key: 'uploads/to-delete.jpg',
      });
    });

    it('should propagate S3 errors', async () => {
      mockS3Send.mockRejectedValue(new Error('S3 access denied'));

      await expect(service.deleteFile('restricted/file.jpg')).rejects.toThrow('S3 access denied');
    });
  });

  // ─── copyFile ─────────────────────────────────────────────────────────────

  describe('copyFile', () => {
    it('should call S3 CopyObjectCommand and return destination URL', async () => {
      mockS3Send.mockResolvedValue({});

      const destUrl = await service.copyFile('uploads/original.jpg', 'uploads/copy.jpg');

      expect(destUrl).toBe('https://handla-uploads.s3.us-east-1.amazonaws.com/uploads/copy.jpg');

      const { CopyObjectCommand } = require('@aws-sdk/client-s3');
      expect(CopyObjectCommand).toHaveBeenCalledWith({
        Bucket: 'handla-uploads',
        CopySource: 'handla-uploads/uploads/original.jpg',
        Key: 'uploads/copy.jpg',
      });
    });
  });

  // ─── fileExists ───────────────────────────────────────────────────────────

  describe('fileExists', () => {
    it('should return true when HeadObject succeeds', async () => {
      mockS3Send.mockResolvedValue({});

      const exists = await service.fileExists('uploads/present.jpg');

      expect(exists).toBe(true);
    });

    it('should return false when HeadObject throws (file not found)', async () => {
      mockS3Send.mockRejectedValue({ name: 'NotFound' });

      const exists = await service.fileExists('uploads/missing.jpg');

      expect(exists).toBe(false);
    });
  });

  // ─── buildFileUrl ─────────────────────────────────────────────────────────

  describe('buildFileUrl', () => {
    it('should return the correct S3 HTTPS URL for a given key', () => {
      const url = service.buildFileUrl('uploads/image.png');

      expect(url).toBe('https://handla-uploads.s3.us-east-1.amazonaws.com/uploads/image.png');
    });

    it('should handle keys with deep paths', () => {
      const url = service.buildFileUrl('a/b/c/deep.png');

      expect(url).toBe('https://handla-uploads.s3.us-east-1.amazonaws.com/a/b/c/deep.png');
    });
  });

  // ─── getKeyFromUrl ────────────────────────────────────────────────────────

  describe('getKeyFromUrl', () => {
    it('should extract key from a valid S3 URL', () => {
      const key = service.getKeyFromUrl(
        'https://handla-uploads.s3.us-east-1.amazonaws.com/uploads/photo.jpg',
      );

      expect(key).toBe('uploads/photo.jpg');
    });

    it('should return null for a URL that does not match the bucket/region', () => {
      const key = service.getKeyFromUrl('https://other-bucket.s3.amazonaws.com/file.jpg');

      expect(key).toBeNull();
    });

    it('should return null for an empty string', () => {
      expect(service.getKeyFromUrl('')).toBeNull();
    });

    it('should round-trip buildFileUrl → getKeyFromUrl correctly', () => {
      const originalKey = 'uploads/folder/file.txt';
      const url = service.buildFileUrl(originalKey);
      const extractedKey = service.getKeyFromUrl(url);

      expect(extractedKey).toBe(originalKey);
    });
  });

  // ─── key prefix (AWS_S3_KEY_PREFIX) ─────────────────────────────────────────

  describe('keyPrefix = "handla"', () => {
    let prefixed: AwsService;

    beforeEach(async () => {
      const cfg = {
        get: jest.fn((key: string) =>
          key === 'aws.keyPrefix' ? 'handla' : configValues[key],
        ),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [AwsService, { provide: ConfigService, useValue: cfg }],
      }).compile();
      prefixed = module.get<AwsService>(AwsService);
    });

    it('buildFileUrl prepends the prefix to the physical path', () => {
      expect(prefixed.buildFileUrl('chat/u1/file.pdf')).toBe(
        'https://handla-uploads.s3.us-east-1.amazonaws.com/handla/chat/u1/file.pdf',
      );
    });

    it('generatePresignedUrl stores the prefixed physical key but a logical fileUrl', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed.example.com');
      const res = await prefixed.generatePresignedUrl('chat/u1/file.pdf', 'application/pdf');

      expect(res.key).toBe('handla/chat/u1/file.pdf');
      expect(res.fileUrl).toBe(
        'https://handla-uploads.s3.us-east-1.amazonaws.com/handla/chat/u1/file.pdf',
      );
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Key: 'handla/chat/u1/file.pdf' }),
      );
    });

    it('deleteFile targets the prefixed physical key', async () => {
      mockS3Send.mockResolvedValue({});
      await prefixed.deleteFile('avatars/u1/a.png');
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'handla-uploads',
        Key: 'handla/avatars/u1/a.png',
      });
    });

    it('is idempotent — a key already carrying the prefix is not double-prefixed', () => {
      expect(prefixed.buildFileUrl('handla/contracts/x.html')).toBe(
        'https://handla-uploads.s3.us-east-1.amazonaws.com/handla/contracts/x.html',
      );
    });

    it('getKeyFromUrl strips the prefix so it round-trips through the logical key', () => {
      const logical = 'contracts/abc.html';
      const url = prefixed.buildFileUrl(logical);
      expect(url).toContain('/handla/contracts/abc.html');
      expect(prefixed.getKeyFromUrl(url)).toBe(logical);
    });
  });

  // ─── PT-02: resolveLogicalKey + isKeyInNamespace ────────────────────────────
  describe('resolveLogicalKey (PT-02)', () => {
    it('extracts the logical key from a full in-bucket URL', () => {
      const url = 'https://handla-uploads.s3.us-east-1.amazonaws.com/chat/u-1/1-a.pdf';
      expect(service.resolveLogicalKey(url)).toBe('chat/u-1/1-a.pdf');
    });

    it('returns the bare key unchanged (minus leading slash)', () => {
      expect(service.resolveLogicalKey('/chat/u-1/x.pdf')).toBe('chat/u-1/x.pdf');
    });

    it('returns null for an external URL (not our bucket)', () => {
      expect(service.resolveLogicalKey('https://evil.example.com/x.pdf')).toBeNull();
    });

    it('returns null for an already-presigned URL (opaque, cannot re-validate)', () => {
      expect(
        service.resolveLogicalKey(
          'https://handla-uploads.s3.us-east-1.amazonaws.com/chat/u-1/x.pdf?X-Amz-Signature=abc',
        ),
      ).toBeNull();
    });

    it('returns null for empty/nullish input', () => {
      expect(service.resolveLogicalKey('')).toBeNull();
      expect(service.resolveLogicalKey(null)).toBeNull();
      expect(service.resolveLogicalKey(undefined)).toBeNull();
    });
  });

  describe('isKeyInNamespace (PT-02)', () => {
    it('accepts a key inside the chat namespace', () => {
      expect(service.isKeyInNamespace('chat/u-1/x.pdf', ['chat'])).toBe(true);
    });

    it('rejects a key in a different namespace', () => {
      expect(service.isKeyInNamespace('contracts/secret.pdf', ['chat'])).toBe(false);
    });

    it('rejects a path-traversal key', () => {
      expect(service.isKeyInNamespace('chat/u-1/../u-2/x.pdf', ['chat'])).toBe(false);
    });

    it('rejects absolute and backslash keys', () => {
      expect(service.isKeyInNamespace('/chat/x.pdf', ['chat'])).toBe(false);
      expect(service.isKeyInNamespace('chat\\x.pdf', ['chat'])).toBe(false);
    });

    it('rejects null/empty', () => {
      expect(service.isKeyInNamespace(null, ['chat'])).toBe(false);
      expect(service.isKeyInNamespace('', ['chat'])).toBe(false);
    });

    it('does not treat a namespace-prefixed lookalike as inside (chatx/ ≠ chat/)', () => {
      expect(service.isKeyInNamespace('chatx/u-1/x.pdf', ['chat'])).toBe(false);
    });
  });
});
