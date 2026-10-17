import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module';
import { configureErrorHandling } from '@/bootstrap/configure-error-handling';
import { configureHttp } from '@/bootstrap/configure-http';
import { configureOpenApi } from '@/bootstrap/configure-openapi';
import { configureSecurity } from '@/bootstrap/configure-security';
import { loadEnv } from '@/configs/load-env';

describe('platform http', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const config = loadEnv({ NODE_ENV: 'test', OPENAPI_ENABLED: 'true' });
    app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
    configureHttp(app, config);
    configureSecurity(app, config);
    expect(configureErrorHandling(app)).toBe(app);
    configureOpenApi(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports liveness without infrastructure credentials', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('propagates a safe correlation id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'req-123');

    expect(response.headers['x-request-id']).toBe('req-123');
  });

  it('replaces an unsafe correlation id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'bad id');

    expect(response.headers['x-request-id']).not.toBe('bad id');
  });

  it('reports readiness without infrastructure details when dependencies are unset', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ready',
      checks: { database: 'not_configured', redis: 'not_configured' },
    });
    expect(JSON.stringify(response.body)).not.toContain('postgres');
  });

  it('hides metrics until a token is configured', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/metrics');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('rejects a protected platform route without a bearer token', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/context');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED', statusCode: 401 });
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it('keeps repeated liveness requests inside a local latency bound', async () => {
    const samples: number[] = [];
    for (let index = 0; index < 30; index += 1) {
      const started = performance.now();
      const response = await request(app.getHttpServer()).get('/api/v1/health');
      samples.push(performance.now() - started);
      expect(response.status).toBe(200);
    }
    samples.sort((left, right) => left - right);
    const p50 = samples[Math.floor(samples.length / 2)] ?? 0;
    const max = samples[samples.length - 1] ?? 0;
    process.stdout.write(
      `health workload=30 concurrency=1 p50_ms=${p50.toFixed(1)} max_ms=${max.toFixed(1)}\n`,
    );
    expect(max).toBeLessThan(1000);
  });

  it('exposes the openapi document when enabled', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json');

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toContain('health');
  });
});
