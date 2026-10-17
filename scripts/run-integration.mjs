import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadIntegrationEnv } from './integration-env-file.mjs';
import {
  validateIntegrationDatabaseUrl,
  validateIntegrationRedisUrl,
} from './integration-guards.mjs';
import { probeTcp } from './tcp-probe.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

async function main() {
  const { env, file } = loadIntegrationEnv(rootDir);
  if (!file.present || file.loaded === 0) {
    process.stderr.write(
      'Missing .env.integration. Run pnpm env:setup:integration and edit INTEGRATION_DATABASE_URL and INTEGRATION_REDIS_URL.\n',
    );
    process.exit(1);
  }

  const database = validateIntegrationDatabaseUrl(env['INTEGRATION_DATABASE_URL']);
  if (!database.ok) {
    process.stderr.write(`${database.message}\n`);
    process.exit(1);
  }

  const redis = validateIntegrationRedisUrl(env['INTEGRATION_REDIS_URL']);
  if (!redis.ok) {
    process.stderr.write(`${redis.message}\n`);
    process.exit(1);
  }

  if (!(await probeTcp(database.host, database.port))) {
    process.stderr.write(
      `PostgreSQL is not reachable at ${database.host}:${String(database.port)}. Start your local server or fix INTEGRATION_DATABASE_URL in .env.integration.\n`,
    );
    process.exit(1);
  }

  if (!(await probeTcp(redis.host, redis.port))) {
    process.stderr.write(
      `Redis is not reachable at ${redis.host}:${String(redis.port)}. Start test Redis (for example docker compose -f docker-compose.test.yml up -d) or point INTEGRATION_REDIS_URL to a running local Redis with index /15.\n`,
    );
    process.exit(1);
  }

  const childEnv = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('INTEGRATION_') && value !== undefined) {
      childEnv[key] = value;
    }
  }

  process.stdout.write(
    `Loaded ${String(file.loaded)} INTEGRATION_* variable(s) from .env.integration. DATABASE_URL and REDIS_URL were not modified.\n`,
  );

  const result = spawnSync('pnpm', ['--filter', '@softtech/api', 'test:integration'], {
    cwd: rootDir,
    env: childEnv,
    shell: true,
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Integration runner failed'}\n`);
  process.exit(1);
});
