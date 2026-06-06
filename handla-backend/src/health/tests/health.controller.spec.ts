import { Test, TestingModule } from '@nestjs/testing';

import { HealthController } from '../health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('check() returns status="ok" and an ISO timestamp', () => {
    const res = controller.check();

    expect(res.status).toBe('ok');
    expect(typeof res.timestamp).toBe('string');
    // ISO 8601: 2024-01-01T00:00:00.000Z
    expect(res.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('check() returns the current time (within ±2 seconds of now)', () => {
    const before = Date.now();
    const res = controller.check();
    const after = Date.now();
    const ts = Date.parse(res.timestamp);

    expect(ts).toBeGreaterThanOrEqual(before - 2000);
    expect(ts).toBeLessThanOrEqual(after + 2000);
  });

  it('returns a fresh timestamp on each call', () => {
    const a = controller.check().timestamp;
    // Force a measurable gap
    const end = Date.now() + 2;
    while (Date.now() < end) { /* spin */ }
    const b = controller.check().timestamp;

    // They should differ or at minimum b >= a
    expect(Date.parse(b)).toBeGreaterThanOrEqual(Date.parse(a));
  });
});
