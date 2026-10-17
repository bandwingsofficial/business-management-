import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadIntegrationEnv } from './integration-env-file.mjs';
import { validateIntegrationDatabaseUrl } from './integration-guards.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const apiDir = path.join(rootDir, 'apps', 'api');

function main() {
  const command = process.argv.slice(2);
  if (command.length === 0) {
    process.stderr.write('Usage: node scripts/with-integration-database.mjs <command...>\n');
    process.exit(1);
  }

  const { env } = loadIntegrationEnv(rootDir);
  const validation = validateIntegrationDatabaseUrl(env['INTEGRATION_DATABASE_URL']);
  if (!validation.ok) {
    process.stderr.write(`${validation.message}\n`);
    process.exit(1);
  }

  const childEnv = { ...process.env, DATABASE_URL: env['INTEGRATION_DATABASE_URL'] };
  delete childEnv['INTEGRATION_DATABASE_URL'];

  const result = spawnSync(command[0], command.slice(1), {
    cwd: apiDir,
    env: childEnv,
    shell: true,
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

main();
