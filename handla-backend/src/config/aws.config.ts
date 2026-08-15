import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  s3Bucket: process.env.AWS_S3_BUCKET || 'handla-uploads',
  presignedUrlExpiry: parseInt(process.env.AWS_S3_PRESIGNED_URL_EXPIRY || '900', 10),
  // Optional top-level folder all objects are stored under (e.g. "handla").
  // Empty = store at bucket root (historical behaviour).
  keyPrefix: process.env.AWS_S3_KEY_PREFIX || '',
}));
