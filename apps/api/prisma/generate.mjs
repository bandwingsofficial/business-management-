import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Client generation needs a URL string in the Prisma config. This placeholder is
// never read by the API process and is not a production credential.
if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] =
    'postgresql://softtech:softtech@127.0.0.1:5432/softtech?schema=public';
}

const result = spawnSync('prisma generate', {
  cwd: packageRoot,
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
