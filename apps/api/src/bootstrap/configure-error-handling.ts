import type { INestApplication } from '@nestjs/common';

import { PlatformExceptionFilter } from '@/platform/http/platform-exception.filter';

export function configureErrorHandling(app: INestApplication): INestApplication {
  try {
    const filter = app.get(PlatformExceptionFilter, { strict: false });
    if (filter) {
      app.useGlobalFilters(filter);
    }
  } catch {
    return app;
  }
  return app;
}
