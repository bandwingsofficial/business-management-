import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import type { AppConfig } from '@/configs/app-config';

export function configureOpenApi(app: INestApplication, config: AppConfig): void {
  if (!config.openapi.enabled) {
    return;
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(config.openapi.title)
      .setDescription(config.openapi.description)
      .setVersion(config.http.defaultVersion)
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });
}
