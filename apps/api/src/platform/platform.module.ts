import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { StructuredLogger } from '@/common/logging/structured-logger';
import type {
  AppSettings,
  AuthSettings,
  EmailSettings,
  HttpSettings,
  JobsSettings,
  LoggingSettings,
  ObservabilitySettings,
  StorageSettings,
} from '@/configs/app-config';
import { JwksTokenVerifier } from '@/infrastructure/auth/jwks-token-verifier';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaAuditLog } from '@/infrastructure/database/prisma-audit.log';
import { PrismaMembershipStore } from '@/infrastructure/database/prisma-membership.store';
import { PrismaRevocationStore } from '@/infrastructure/database/prisma-revocation.store';
import { SmtpEmailSender } from '@/infrastructure/email/smtp-email-sender';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { RedisCacheStore } from '@/infrastructure/redis/redis-cache.store';

import { AccessResolver } from './access/access-resolver';
import { InMemoryMembershipStore } from './access/membership-store';
import { createRateLimiter, type RateLimiter } from './access/rate-limiter';
import { createRevocationStore, type CredentialRevocationStore } from './access/revocation-store';
import { RejectingTokenVerifier } from './access/token-verifier';
import {
  AUDIT_LOG,
  CACHE,
  EMAIL_SENDER,
  MEMBERSHIP_STORE,
  OBJECT_STORAGE,
  RATE_LIMITER,
  REVOCATION_STORE,
  TOKEN_VERIFIER,
} from './access/tokens';
import { InMemoryAuditLog } from './audit/audit-log';
import { MemoryCacheStore, TenantCache } from './cache/tenant-cache';
import { DisabledEmailSender } from './email/email-sender';
import { HealthModule } from './health/health.module';
import { AuthGuard } from './http/auth.guard';
import { PlatformController } from './http/platform.controller';
import { PlatformExceptionFilter } from './http/platform-exception.filter';
import { RequestLogInterceptor } from './http/request-log.interceptor';
import { ErrorReporter } from './observability/error-reporter';
import { MetricsRegistry } from './observability/metrics';
import { MetricsController } from './observability/metrics.controller';
import { SentryErrorReporter } from './observability/telemetry';
import { DisabledObjectStorage } from './storage/object-storage';

@Module({
  imports: [HealthModule],
  controllers: [PlatformController, MetricsController],
  providers: [
    MetricsRegistry,
    RequestLogInterceptor,
    PlatformExceptionFilter,
    {
      provide: StructuredLogger,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StructuredLogger => {
        const app = config.getOrThrow<AppSettings>('app');
        const logging = config.getOrThrow<LoggingSettings>('logging');
        return new StructuredLogger({
          env: app.env,
          level: logging.level,
          serviceName: app.name,
          json: app.env === 'production',
        });
      },
    },
    {
      provide: ErrorReporter,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ErrorReporter => {
        const observability = config.getOrThrow<ObservabilitySettings>('observability');
        return observability.sentryDsn === undefined
          ? new ErrorReporter()
          : new SentryErrorReporter();
      },
    },
    {
      provide: TOKEN_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RejectingTokenVerifier | JwksTokenVerifier => {
        const auth = config.getOrThrow<AuthSettings>('auth');
        if (
          auth.issuer !== undefined &&
          auth.audience !== undefined &&
          auth.jwksUri !== undefined
        ) {
          return new JwksTokenVerifier(auth.issuer, auth.audience, auth.jwksUri);
        }
        return new RejectingTokenVerifier();
      },
    },
    {
      provide: MEMBERSHIP_STORE,
      inject: [{ token: PrismaService, optional: true }],
      useFactory: (prisma?: PrismaService): PrismaMembershipStore | InMemoryMembershipStore =>
        prisma === undefined ? new InMemoryMembershipStore([]) : new PrismaMembershipStore(prisma),
    },
    {
      provide: REVOCATION_STORE,
      inject: [ConfigService, { token: PrismaService, optional: true }],
      useFactory: (config: ConfigService, prisma?: PrismaService): CredentialRevocationStore => {
        if (prisma !== undefined) {
          return new PrismaRevocationStore(prisma);
        }
        return createRevocationStore(config.getOrThrow<AppSettings>('app').env);
      },
    },
    {
      provide: AUDIT_LOG,
      inject: [{ token: PrismaService, optional: true }],
      useFactory: (prisma?: PrismaService): PrismaAuditLog | InMemoryAuditLog =>
        prisma === undefined ? new InMemoryAuditLog() : new PrismaAuditLog(prisma),
    },
    {
      provide: RATE_LIMITER,
      inject: [{ token: RedisService, optional: true }],
      useFactory: (redis?: RedisService): RateLimiter =>
        createRateLimiter(redis === undefined ? undefined : redis.client),
    },
    {
      provide: CACHE,
      inject: [{ token: RedisService, optional: true }],
      useFactory: (redis?: RedisService): TenantCache =>
        new TenantCache(redis === undefined ? new MemoryCacheStore() : new RedisCacheStore(redis)),
    },
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DisabledObjectStorage => {
        config.getOrThrow<StorageSettings>('storage');
        return new DisabledObjectStorage();
      },
    },
    {
      provide: EMAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DisabledEmailSender | SmtpEmailSender => {
        const email = config.getOrThrow<EmailSettings>('email');
        return email.driver === 'smtp' ? new SmtpEmailSender(email) : new DisabledEmailSender();
      },
    },
    {
      provide: AccessResolver,
      inject: [TOKEN_VERIFIER, MEMBERSHIP_STORE, REVOCATION_STORE, RATE_LIMITER, ConfigService],
      useFactory: (
        tokens: RejectingTokenVerifier | JwksTokenVerifier,
        memberships: PrismaMembershipStore | InMemoryMembershipStore,
        revocation: CredentialRevocationStore,
        limiter: RateLimiter,
        config: ConfigService,
      ): AccessResolver => {
        const http = config.getOrThrow<HttpSettings>('http');
        config.getOrThrow<JobsSettings>('jobs');
        return new AccessResolver(
          tokens,
          memberships,
          revocation,
          limiter,
          http.authRateLimitMax,
          http.rateLimitWindowSeconds,
        );
      },
    },
    AuthGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_INTERCEPTOR, useExisting: RequestLogInterceptor },
  ],
})
export class PlatformModule {}
