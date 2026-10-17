import { Controller, Get, Module, type NestMiddleware } from '@nestjs/common';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configureErrorHandling } from '@/bootstrap/configure-error-handling';
import { configureHttp } from '@/bootstrap/configure-http';
import { ApplicationError } from '@/common/errors/application-error';
import { translateDatabaseError } from '@/common/errors/translate-database-error';
import { CorrelationIdMiddleware } from '@/common/http/correlation-id.middleware';
import { StructuredLogger } from '@/common/logging/structured-logger';
import { loadEnv } from '@/configs/load-env';
import { resolveIsolation } from '@/infrastructure/database/unit-of-work';

import { ErrorReporter } from '../observability/error-reporter';
import { MetricsRegistry } from '../observability/metrics';
import { PlatformExceptionFilter } from './platform-exception.filter';

const lines: string[] = [];

@Controller({ version: '1' })
class FailureController {
  @Get('known')
  public known(): void {
    throw new ApplicationError(
      'RESOURCE_CONFLICT',
      'The requested operation conflicts with existing data.',
      undefined,
      409,
    );
  }

  @Get('unknown')
  public unknown(): void {
    throw new Error('password=super-secret-password');
  }
}

@Module({
  controllers: [FailureController],
  providers: [
    {
      provide: StructuredLogger,
      useValue: new StructuredLogger(
        { env: 'test', level: 'error', serviceName: 'test', json: true },
        {
          write(line: string): void {
            lines.push(line);
          },
        },
      ),
    },
    MetricsRegistry,
    ErrorReporter,
    PlatformExceptionFilter,
  ],
})
class FailureModule {}

describe('platform errors', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(FailureModule, { logger: ['error'], abortOnError: false });
    const middleware: NestMiddleware = new CorrelationIdMiddleware();
    app.use(middleware.use.bind(middleware));
    configureHttp(app, loadEnv({ NODE_ENV: 'test' }));
    configureErrorHandling(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the stable body for a known conflict', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/known')
      .set('x-request-id', 'req-known');
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      statusCode: 409,
      code: 'RESOURCE_CONFLICT',
      message: 'The requested operation conflicts with existing data.',
      requestId: 'req-known',
      details: [],
    });
  });

  it('hides unknown error details and redacts the log', async () => {
    lines.length = 0;
    const response = await request(app.getHttpServer())
      .get('/api/v1/unknown')
      .set('x-request-id', 'req-unknown');
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ code: 'INTERNAL_ERROR', requestId: 'req-unknown' });
    expect(JSON.stringify(response.body)).not.toContain('super-secret-password');
    expect(lines.join('\n')).not.toContain('super-secret-password');
  });
});

describe('database error translation', () => {
  it('maps known prisma codes and leaves unknown errors untouched', () => {
    expect(translateDatabaseError({ code: 'P2002' })?.code).toBe('RESOURCE_CONFLICT');
    expect(translateDatabaseError({ code: 'P2025' })?.statusCode).toBe(404);
    expect(translateDatabaseError({ code: 'P1001' })?.statusCode).toBe(503);
    expect(translateDatabaseError(new Error('select password'))).toBeUndefined();
  });

  it('defaults transactions to read committed', () => {
    expect(resolveIsolation()).toBe('ReadCommitted');
    expect(resolveIsolation({ isolationLevel: 'Serializable' })).toBe('Serializable');
  });
});
