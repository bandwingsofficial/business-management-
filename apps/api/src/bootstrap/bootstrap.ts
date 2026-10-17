import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';

import { AppModule } from '@/app.module';
import { loadEnv } from '@/configs/load-env';
import { nestLoggerLevels } from '@/configs/nest-logger';
import { formatStartupSummary } from '@/configs/startup-summary';
import { startTelemetry } from '@/platform/observability/telemetry';

import { configureErrorHandling } from './configure-error-handling';
import { configureHttp } from './configure-http';
import { configureOpenApi } from './configure-openapi';
import { configureSecurity } from './configure-security';
import { loadLocalEnv } from './load-local-env';

export async function bootstrap(): Promise<void> {
  loadLocalEnv();
  const config = loadEnv();
  await startTelemetry(config);
  const app = await NestFactory.create(AppModule, {
    logger: nestLoggerLevels(config.logging.level),
    bodyParser: false,
  });
  app.use(json({ limit: config.http.bodyLimitBytes }));

  configureHttp(app, config);
  configureSecurity(app, config);
  configureErrorHandling(app);
  configureOpenApi(app, config);
  app.enableShutdownHooks();

  await app.listen(config.http.port, config.http.host);
  Logger.log(formatStartupSummary(config), 'Bootstrap');
}
