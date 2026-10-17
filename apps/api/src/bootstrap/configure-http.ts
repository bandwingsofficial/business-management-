import { type INestApplication, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';

import { RequestValidationInterceptor } from '@/common/validation/request-validation.interceptor';
import type { AppConfig } from '@/configs/app-config';

export function configureHttp(app: INestApplication, config: AppConfig): void {
  app.setGlobalPrefix(config.http.prefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: config.http.defaultVersion,
  });
  app.useGlobalInterceptors(new RequestValidationInterceptor(app.get(Reflector)));
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setTimeout(config.http.timeoutMs);
    next();
  });
}
