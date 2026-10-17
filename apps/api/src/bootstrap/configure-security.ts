import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

import type { AppConfig } from '@/configs/app-config';

export function configureSecurity(app: INestApplication, config: AppConfig): void {
  if (config.security.helmetEnabled) {
    app.use(helmet());
  }

  const http = app.getHttpAdapter().getInstance() as { set: (key: string, value: number) => void };
  if (config.http.trustProxy) {
    http.set('trust proxy', 1);
  }

  app.enableCors({
    origin: config.http.corsOrigins.length > 0 ? [...config.http.corsOrigins] : false,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'x-organization-id',
      'traceparent',
    ],
    exposedHeaders: ['x-request-id'],
  });
}
