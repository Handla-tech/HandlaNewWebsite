import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TestimonialService } from '../testimonial.service';
import { Testimonial } from '../entities/testimonial.entity';
import { CreateTestimonialDto } from '../dto/create-testimonial.dto';
import { UpdateTestimonialDto } from '../dto/update-testimonial.dto';
import { TestimonialQueryDto } from '../dto/testimonial-query.dto';
import { ResourceNotFoundException } from '../../../utils/exceptions';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ADMIN_ID = 'admin-uuid-1';

const mockTestimonial: Testimonial = {
  id: 'testimonial-uuid-1',
  clientName: 'Jane Doe',
  clientCompany: 'Acme Corp',
  content: 'Handla delivered an exceptional product well ahead of schedule.',
  imageUrl: 'https://example.com/jane.jpg',
  rating: 5,
  createdByAdminId: ADMIN_ID,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
  createdByAdmin: null as any,
};

// ─── Repository Mock ─────────────────────────────────────────────────────────

const mockTestimonialRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  remove: jest.fn(),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TestimonialService', () => {
  let service: TestimonialService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestimonialService,
        {
          provide: getRepositoryToken(Testimonial),
          useValue: mockTestimonialRepository,
        },
      ],
    }).compile();

    service = module.get<TestimonialService>(TestimonialService);
    jest.clearAllMocks();
  });

  // ─── create() ────────────────────────────────────────────────────────────────
  describe('create()', () => {
    const createDto: CreateTestimonialDto = {
      clientName: 'Jane Doe',
      clientCompany: 'Acme Corp',
      content: 'Handla delivered an exceptional product well ahead of schedule.',
      imageUrl: 'https://example.com/jane.jpg',
      rating: 5,
    };

    it('should create and return a testimonial', async () => {
      mockTestimonialRepository.create.mockReturnValue(mockTestimonial);
      mockTestimonialRepository.save.mockResolvedValue(mockTestimonial);

      const result = await service.create(createDto, ADMIN_ID);

      expect(mockTestimonialRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: 'Jane Doe',
          clientCompany: 'Acme Corp',
          rating: 5,
          createdByAdminId: ADMIN_ID,
        }),
      );
      expect(mockTestimonialRepository.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('testimonial-uuid-1');
    });

    it('should set clientCompany to null when not provided', async () => {
      const dtoNoCompany = { ...createDto, clientCompany: undefined };
      const testimonialNoCompany = { ...mockTestimonial, clientCompany: null };
      mockTestimonialRepository.create.mockReturnValue(testimonialNoCompany);
      mockTestimonialRepository.save.mockResolvedValue(testimonialNoCompany);

      await service.create(dtoNoCompany, ADMIN_ID);

      expect(mockTestimonialRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientCompany: null }),
      );
    });

    it('should set imageUrl to null when not provided', async () => {
      const dtoNoImage = { ...createDto, imageUrl: undefined };
      const testimonialNoImage = { ...mockTestimonial, imageUrl: null };
      mockTestimonialRepository.create.mockReturnValue(testimonialNoImage);
      mockTestimonialRepository.save.mockResolvedValue(testimonialNoImage);

      await service.create(dtoNoImage, ADMIN_ID);

      expect(mockTestimonialRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: null }),
      );
    });
  });

  // ─── findAll() ────────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('should return paginated testimonials ordered by createdAt DESC', async () => {
      mockTestimonialRepository.findAndCount.mockResolvedValue([[mockTestimonial], 1]);

      const query: TestimonialQueryDto = { page: 1, limit: 10 };
      const result = await service.findAll(query);

      expect(result.testimonials).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
      expect(mockTestimonialRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should correctly calculate pagination (page 2, limit 5)', async () => {
      const items = [mockTestimonial, mockTestimonial, mockTestimonial];
      mockTestimonialRepository.findAndCount.mockResolvedValue([items, 12]);

      const query: TestimonialQueryDto = { page: 2, limit: 5 };
      const result = await service.findAll(query);

      expect(result.page).toBe(2);
      expect(result.pages).toBe(3); // ceil(12/5) = 3
      expect(mockTestimonialRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it('should return empty list when no testimonials exist', async () => {
      mockTestimonialRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.testimonials).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.pages).toBe(0);
    });
  });

  // ─── findOne() ────────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it('should return a testimonial by id', async () => {
      mockTestimonialRepository.findOne.mockResolvedValue(mockTestimonial);

      const result = await service.findOne(mockTestimonial.id);

      expect(result).toEqual(mockTestimonial);
      expect(mockTestimonialRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTestimonial.id },
      });
    });

    it('should throw ResourceNotFoundException when testimonial does not exist', async () => {
      mockTestimonialRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('bad-uuid')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ─── update() ─────────────────────────────────────────────────────────────────
  describe('update()', () => {
    it('should update only provided fields and return updated testimonial', async () => {
      const existing = { ...mockTestimonial };
      mockTestimonialRepository.findOne.mockResolvedValue(existing);
      const updated = { ...existing, rating: 4, content: 'Great work overall.' };
      mockTestimonialRepository.save.mockResolvedValue(updated);

      const dto: UpdateTestimonialDto = { rating: 4, content: 'Great work overall.' };
      const result = await service.update(mockTestimonial.id, dto);

      expect(result.rating).toBe(4);
      expect(result.content).toBe('Great work overall.');
      // clientName should remain unchanged
      expect(result.clientName).toBe('Jane Doe');
    });

    it('should allow setting clientCompany to null explicitly', async () => {
      const existing = { ...mockTestimonial };
      mockTestimonialRepository.findOne.mockResolvedValue(existing);
      const updated = { ...existing, clientCompany: null };
      mockTestimonialRepository.save.mockResolvedValue(updated);

      const dto: UpdateTestimonialDto = { clientCompany: undefined };
      // Pass null explicitly via the dto shape
      const result = await service.update(mockTestimonial.id, { clientCompany: null } as any);

      expect(result.clientCompany).toBeNull();
    });

    it('should throw ResourceNotFoundException when testimonial does not exist', async () => {
      mockTestimonialRepository.findOne.mockResolvedValue(null);

      await expect(service.update('bad-uuid', { rating: 3 })).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  // ─── remove() ─────────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it('should delete an existing testimonial', async () => {
      mockTestimonialRepository.findOne.mockResolvedValue(mockTestimonial);
      mockTestimonialRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockTestimonial.id);

      expect(mockTestimonialRepository.remove).toHaveBeenCalledWith(mockTestimonial);
    });

    it('should throw ResourceNotFoundException when testimonial does not exist', async () => {
      mockTestimonialRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('bad-uuid')).rejects.toThrow(ResourceNotFoundException);
      expect(mockTestimonialRepository.remove).not.toHaveBeenCalled();
    });
  });
});
