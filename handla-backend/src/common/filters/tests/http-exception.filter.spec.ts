import { AllExceptionsFilter } from '../http-exception.filter';
import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Security-focused coverage for the global exception filter.
 *
 * The key guarantee: raw runtime/ORM error text (which can contain SQL,
 * file paths, secrets) is NEVER surfaced to the client in production, while
 * client-fault (4xx) messages ARE preserved for good DX.
 */
describe('AllExceptionsFilter', () => {
  const originalEnv = process.env.NODE_ENV;

  let filter: AllExceptionsFilter;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let host: ArgumentsHost;
  let captured: any;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jsonMock = jest.fn((body) => {
      captured = body;
    });
    statusMock = jest.fn(() => ({ json: jsonMock }));

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ method: 'GET', url: '/api/test' }),
      }),
    } as unknown as ArgumentsHost;

    // Silence the logger noise during assertions.
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('preserves 4xx client-fault messages (BadRequest)', () => {
    process.env.NODE_ENV = 'production';
    filter.catch(new BadRequestException('email must be an email'), host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(captured.statusCode).toBe(400);
    expect(captured.message).toBe('email must be an email');
    expect(captured.success).toBe(false);
  });

  it('preserves NotFound messages', () => {
    process.env.NODE_ENV = 'production';
    filter.catch(new NotFoundException('Tenant abc not found'), host);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(captured.message).toBe('Tenant abc not found');
  });

  it('HIDES raw runtime error text in production (no leak)', () => {
    process.env.NODE_ENV = 'production';
    const leaky = new Error(
      "ER_PARSE_ERROR: SQL syntax near 'DROP TABLE users' at /app/db/secret.ts:42",
    );
    filter.catch(leaky, host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(captured.message).toBe('Internal server error');
    expect(captured.message).not.toContain('SQL');
    expect(captured.message).not.toContain('DROP TABLE');
    expect(captured.message).not.toContain('secret.ts');
  });

  it('HIDES 5xx HttpException detail in production', () => {
    process.env.NODE_ENV = 'production';
    filter.catch(new InternalServerErrorException('db pool exhausted at pool.ts'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(captured.message).toBe('Internal server error');
  });

  it('shows raw error text in development (for debugging)', () => {
    process.env.NODE_ENV = 'development';
    filter.catch(new Error('boom detail'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(captured.message).toBe('boom detail');
  });

  it('formats validation errors array', () => {
    process.env.NODE_ENV = 'production';
    filter.catch(
      new BadRequestException({ message: ['field a required', 'field b invalid'] }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(captured.message).toBe('Validation failed');
    expect(captured.errors).toEqual(['field a required', 'field b invalid']);
  });
});
