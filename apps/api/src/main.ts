import 'reflect-metadata';

import { bootstrap } from '@/bootstrap/bootstrap';

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Application failed to start';
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
