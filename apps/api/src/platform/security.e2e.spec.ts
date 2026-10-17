import {
  type INestApplication,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configureErrorHandling } from '@/bootstrap/configure-error-handling';
import { configureHttp } from '@/bootstrap/configure-http';
import { InfrastructureError } from '@/common/errors/application-error';
import { CorrelationIdMiddleware } from '@/common/http/correlation-id.middleware';
import { StructuredLogger } from '@/common/logging/structured-logger';
import { loadEnv } from '@/configs/load-env';

import { AccessResolver } from './access/access-resolver';
import { InMemoryMembershipStore } from './access/membership-store';
import { FailingRateLimiter, MemoryRateLimiter } from './access/rate-limiter';
import { InMemoryRevocationStore } from './access/revocation-store';
import { StaticTokenVerifier } from './access/token-verifier';
import {
  AUDIT_LOG,
  MEMBERSHIP_STORE,
  OBJECT_STORAGE,
  RATE_LIMITER,
  REVOCATION_STORE,
  TOKEN_VERIFIER,
} from './access/tokens';
import { InMemoryAuditLog } from './audit/audit-log';
import { AuthGuard } from './http/auth.guard';
import { PlatformController } from './http/platform.controller';
import { PlatformExceptionFilter } from './http/platform-exception.filter';
import { ErrorReporter } from './observability/error-reporter';
import { MetricsRegistry } from './observability/metrics';
import { InMemoryObjectStorage } from './storage/object-storage';

const audit = new InMemoryAuditLog();
const revocation = new InMemoryRevocationStore();
const storage = new InMemoryObjectStorage(
  [
    {
      organizationId: 'org-a',
      objectKey: 'file-a',
      fileName: 'a.pdf',
      contentType: 'application/pdf',
      sizeBytes: 12,
    },
    {
      organizationId: 'org-b',
      objectKey: 'file-b',
      fileName: 'b.pdf',
      contentType: 'application/pdf',
      sizeBytes: 12,
    },
  ],
  'test-signing-secret',
);
const tokens = new StaticTokenVerifier(
  new Map([
    [
      'token-a',
      { userId: 'user-a', jti: 'jti-a', expiresAt: new Date('2099-01-01T00:00:00.000Z') },
    ],
    [
      'token-b',
      { userId: 'user-b', jti: 'jti-b', expiresAt: new Date('2099-01-01T00:00:00.000Z') },
    ],
    [
      'token-revoked',
      {
        userId: 'user-revoked',
        jti: 'jti-revoked',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    ],
    [
      'token-member',
      {
        userId: 'user-member',
        jti: 'jti-member',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    ],
  ]),
);
const memberships = new InMemoryMembershipStore([
  { organizationId: 'org-a', userId: 'user-a', role: 'owner', status: 'active' },
  { organizationId: 'org-b', userId: 'user-b', role: 'admin', status: 'active' },
  { organizationId: 'org-a', userId: 'user-member', role: 'member', status: 'active' },
  { organizationId: 'org-a', userId: 'user-revoked', role: 'member', status: 'revoked' },
]);

@Module({
  controllers: [PlatformController],
  providers: [
    { provide: TOKEN_VERIFIER, useValue: tokens },
    { provide: MEMBERSHIP_STORE, useValue: memberships },
    { provide: REVOCATION_STORE, useValue: revocation },
    { provide: RATE_LIMITER, useValue: new MemoryRateLimiter() },
    { provide: AUDIT_LOG, useValue: audit },
    { provide: OBJECT_STORAGE, useValue: storage },
    {
      provide: AccessResolver,
      inject: [TOKEN_VERIFIER, MEMBERSHIP_STORE, REVOCATION_STORE, RATE_LIMITER],
      useFactory: (
        verifier: StaticTokenVerifier,
        store: InMemoryMembershipStore,
        revoked: InMemoryRevocationStore,
        limiter: MemoryRateLimiter,
      ): AccessResolver => new AccessResolver(verifier, store, revoked, limiter, 100, 60),
    },
    {
      provide: StructuredLogger,
      useValue: new StructuredLogger(
        { env: 'test', level: 'fatal', serviceName: 'test', json: true },
        {
          write(): void {
            return;
          },
        },
      ),
    },
    MetricsRegistry,
    ErrorReporter,
    PlatformExceptionFilter,
    AuthGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
class SecurityModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*splat}');
  }
}

describe('tenant isolation', () => {
  let app: INestApplication;
  let auditId = '';

  beforeAll(async () => {
    const seeded = await audit.append({
      organizationId: 'org-a',
      actorId: 'user-a',
      action: 'storage.sign',
      resourceType: 'object',
      resourceId: 'file-a',
    });
    auditId = seeded.id;
    app = await NestFactory.create(SecurityModule, { logger: ['error'], abortOnError: false });
    configureHttp(app, loadEnv({ NODE_ENV: 'test' }));
    configureErrorHandling(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a missing credential', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/context');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('rejects a forged organization id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/context')
      .set('authorization', 'Bearer token-a')
      .set('x-organization-id', 'org-forged');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('MEMBERSHIP_DENIED');
  });

  it('rejects a revoked membership', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/context')
      .set('authorization', 'Bearer token-revoked')
      .set('x-organization-id', 'org-a');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('MEMBERSHIP_DENIED');
  });

  it('does not return another organization audit record to an authorized admin', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/audit/${auditId}`)
      .set('authorization', 'Bearer token-b')
      .set('x-organization-id', 'org-b');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('denies audit access to a member of the same organization', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/audit/${auditId}`)
      .set('authorization', 'Bearer token-member')
      .set('x-organization-id', 'org-a');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('PERMISSION_DENIED');
  });

  it('returns the audit record only inside its organization', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/audit/${auditId}`)
      .set('authorization', 'Bearer token-a')
      .set('x-organization-id', 'org-a');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: auditId, action: 'storage.sign' });
  });

  it('refuses a signed url for another organization object', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/storage/downloads')
      .set('authorization', 'Bearer token-b')
      .set('x-organization-id', 'org-b')
      .set('x-object-key', 'file-a')
      .send({ fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 12 });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('signs a download only for the caller organization', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/storage/downloads')
      .set('authorization', 'Bearer token-a')
      .set('x-organization-id', 'org-a')
      .set('x-request-id', 'req-storage')
      .set('x-object-key', 'file-a')
      .send({ fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 12 });

    expect(response.status).toBe(201);
    expect(response.body.objectKey).toBe('file-a');
    expect(response.body.url).toEqual(expect.any(String));
    expect(await audit.findById({ organizationId: 'org-b' }, auditId)).toBeUndefined();
  });
});

describe('authentication limiter', () => {
  it('fails closed when the limiter is unavailable', async () => {
    const resolver = new AccessResolver(
      new StaticTokenVerifier(new Map()),
      new InMemoryMembershipStore([]),
      new InMemoryRevocationStore(),
      new FailingRateLimiter(),
      5,
      60,
    );

    await expect(
      resolver.authenticate({
        token: 'token-a',
        organizationId: 'org-a',
        rateLimitKey: 'auth:test',
      }),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });

  it('returns 429 after the authentication limit', async () => {
    const resolver = new AccessResolver(
      new StaticTokenVerifier(new Map()),
      new InMemoryMembershipStore([]),
      new InMemoryRevocationStore(),
      new MemoryRateLimiter(() => 1_000),
      1,
      60,
    );

    await expect(
      resolver.authenticate({
        token: undefined,
        organizationId: undefined,
        rateLimitKey: 'auth:once',
      }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    await expect(
      resolver.authenticate({
        token: undefined,
        organizationId: undefined,
        rateLimitKey: 'auth:once',
      }),
    ).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });
});
