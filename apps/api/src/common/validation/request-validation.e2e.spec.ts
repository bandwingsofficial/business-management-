import { Body, Controller, type INestApplication, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { configureHttp } from '@/bootstrap/configure-http';
import { StructuredLogger } from '@/common/logging/structured-logger';
import { loadEnv } from '@/configs/load-env';
import { PlatformExceptionFilter } from '@/platform/http/platform-exception.filter';
import { ErrorReporter } from '@/platform/observability/error-reporter';
import { MetricsRegistry } from '@/platform/observability/metrics';

import { ValidateRequest } from './validate-request.decorator';

const createExampleSchema = z.strictObject({
  name: z.string().min(1),
});

@Controller({ path: 'examples', version: '1' })
class ExamplesController {
  @Post()
  @ValidateRequest(createExampleSchema)
  public create(@Body() body: { name: string }): { name: string } {
    return { name: body.name };
  }
}

@Module({
  controllers: [ExamplesController],
})
class ExamplesModule {}

describe('request validation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(ExamplesModule, { logger: false });
    configureHttp(app, loadEnv({ NODE_ENV: 'test' }));
    app.useGlobalFilters(
      new PlatformExceptionFilter(
        new StructuredLogger(
          { env: 'test', level: 'fatal', serviceName: 'test', json: true },
          {
            write(): void {
              return;
            },
          },
        ),
        new MetricsRegistry(),
        new ErrorReporter(),
      ),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a body that matches the route schema', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/examples')
      .send({ name: 'Ada' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ name: 'Ada' });
  });

  it('rejects an invalid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/examples')
      .send({ name: '', token: 'super-secret-password' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      requestId: 'unknown',
    });
    expect(JSON.stringify(response.body)).not.toContain('super-secret-password');
  });
});
