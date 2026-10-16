import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UploadsCleanupService } from '../uploads-cleanup.service';
import { FileUpload, FileUploadStatus, FileUploadResourceType } from '../entities/file-upload.entity';
import { AwsService } from '../../aws/aws.service';

describe('UploadsCleanupService', () => {
  let service: UploadsCleanupService;

  const mockFileUploadRepo = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockAwsService = {
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsCleanupService,
        { provide: getRepositoryToken(FileUpload), useValue: mockFileUploadRepo },
        { provide: AwsService, useValue: mockAwsService },
      ],
    }).compile();

    service = module.get<UploadsCleanupService>(UploadsCleanupService);
  });

  it('returns 0 when no abandoned uploads exist', async () => {
    mockFileUploadRepo.find.mockResolvedValueOnce([]);

    const result = await service.cleanupOrphanedUploads(24);
    expect(result).toEqual({ cleaned: 0, failed: 0 });
    expect(mockAwsService.deleteFile).not.toHaveBeenCalled();
  });

  it('cleans up abandoned PENDING uploads and marks them EXPIRED', async () => {
    const abandoned = [
      {
        id: 'up-1',
        s3Key: 'tasks/task-1/abandoned-1.pdf',
        status: FileUploadStatus.PENDING,
      },
      {
        id: 'up-2',
        s3Key: 'invoices/inv-1/abandoned-2.png',
        status: FileUploadStatus.PENDING,
      },
    ];
    mockFileUploadRepo.find.mockResolvedValueOnce(abandoned);
    mockAwsService.deleteFile.mockResolvedValue(undefined);
    mockFileUploadRepo.save.mockImplementation(async (r) => r);

    const result = await service.cleanupOrphanedUploads(24);
    expect(result).toEqual({ cleaned: 2, failed: 0 });
    expect(mockAwsService.deleteFile).toHaveBeenCalledWith('tasks/task-1/abandoned-1.pdf');
    expect(mockAwsService.deleteFile).toHaveBeenCalledWith('invoices/inv-1/abandoned-2.png');
    expect(abandoned[0].status).toBe(FileUploadStatus.EXPIRED);
    expect(abandoned[1].status).toBe(FileUploadStatus.EXPIRED);
  });

  it('safely isolates errors when individual S3 deletions fail', async () => {
    const abandoned = [
      {
        id: 'up-1',
        s3Key: 'tasks/task-1/fail.pdf',
        status: FileUploadStatus.PENDING,
      },
      {
        id: 'up-2',
        s3Key: 'tasks/task-1/ok.pdf',
        status: FileUploadStatus.PENDING,
      },
    ];
    mockFileUploadRepo.find.mockResolvedValueOnce(abandoned);
    mockAwsService.deleteFile
      .mockRejectedValueOnce(new Error('S3 500 Internal Error'))
      .mockResolvedValueOnce(undefined);
    mockFileUploadRepo.save.mockImplementation(async (r) => r);

    const result = await service.cleanupOrphanedUploads(24);
    expect(result).toEqual({ cleaned: 1, failed: 1 });
    expect(abandoned[0].status).toBe(FileUploadStatus.PENDING);
    expect(abandoned[1].status).toBe(FileUploadStatus.EXPIRED);
  });
});
