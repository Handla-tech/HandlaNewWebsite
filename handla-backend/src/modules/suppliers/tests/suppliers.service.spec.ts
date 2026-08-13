import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SuppliersService } from '../suppliers.service';
import { Supplier } from '../entities/supplier.entity';

function buildQb(overrides: Record<string, any> = {}) {
  return {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
}

describe('SuppliersService', () => {
  let service: SuppliersService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 's-1', ...x })),
      remove: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: getRepositoryToken(Supplier), useValue: repo },
      ],
    }).compile();
    service = module.get(SuppliersService);
  });

  it('create() persists and defaults isActive true', async () => {
    const res = await service.create({ name: 'Acme' });
    expect(repo.save).toHaveBeenCalled();
    expect(res).toMatchObject({ name: 'Acme', isActive: true });
  });

  it('findOne() throws when missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeDefined();
  });

  it('findAll() paginates', async () => {
    repo.createQueryBuilder.mockReturnValue(
      buildQb({ getManyAndCount: jest.fn().mockResolvedValue([[{ id: 's-1' }], 1]) }),
    );
    const res = await service.findAll({ page: 1, limit: 20 });
    expect(res.total).toBe(1);
    expect(res.pages).toBe(1);
  });

  it('update() applies changes', async () => {
    repo.findOne.mockResolvedValue({ id: 's-1', name: 'Old', isActive: true });
    const res = await service.update('s-1', { name: 'New', isActive: false });
    expect(res.name).toBe('New');
    expect(res.isActive).toBe(false);
  });
});
