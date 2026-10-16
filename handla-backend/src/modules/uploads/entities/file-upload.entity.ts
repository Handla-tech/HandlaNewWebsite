import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FileUploadResourceType {
  TASK = 'TASK',
  INVOICE = 'INVOICE',
}

export enum FileUploadStatus {
  PENDING = 'PENDING',
  CONSUMED = 'CONSUMED',
  EXPIRED = 'EXPIRED',
}

@Entity('file_uploads')
@Index('idx_file_uploads_user_resource', ['userId', 'resourceType', 'resourceId'])
@Index('idx_file_uploads_status_created', ['status', 'createdAt'])
export class FileUpload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  @Index('idx_file_uploads_user_id')
  userId: string;

  @Column({
    name: 'resource_type',
    type: 'enum',
    enum: FileUploadResourceType,
  })
  resourceType: FileUploadResourceType;

  @Column({ name: 'resource_id', type: 'varchar', length: 36 })
  @Index('idx_file_uploads_resource_id')
  resourceId: string;

  @Column({ name: 's3_key', type: 'varchar', length: 500, unique: true })
  @Index('idx_file_uploads_s3_key', { unique: true })
  s3Key: string;

  @Column({ name: 'file_url', type: 'varchar', length: 1000 })
  fileUrl: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @Column({
    type: 'enum',
    enum: FileUploadStatus,
    default: FileUploadStatus.PENDING,
  })
  @Index('idx_file_uploads_status')
  status: FileUploadStatus;

  @Column({ name: 'consumed_at', type: 'datetime', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
