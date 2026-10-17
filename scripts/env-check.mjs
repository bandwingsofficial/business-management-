import { existsSync } from 'node:fs';
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
const checkpointMode = process.argv.includes('--checkpoint');

const REQUIRED_ROOT_SCRIPTS = [
  'env:setup',
  'env:setup:integration',
  'env:check',
  'verify:foundation',
  'verify:infrastructure',
  'test:integration',
  'prisma:generate',
  'db:migrate:status',
  'db:migrate:deploy',
];

function line(label, status, detail) {
  process.stdout.write(`${label}: ${status}${detail === undefined ? '' : ` — ${detail}`}\n`);
}

async function main() {
  if (checkpointMode) {
    process.stdout.write('Softtech Core environment checkpoint (Redis may be deferred)\n\n');
  } else {
    process.stdout.write('Softtech Core strict infrastructure diagnostic\n\n');
  }

  const envFile = path.join(rootDir, '.env');
  const integrationFile = path.join(rootDir, '.env.integration');
  line(
    '.env file',
    existsSync(envFile) ? 'PASS' : 'FAIL',
    existsSync(envFile) ? 'local API configuration present' : 'run pnpm env:setup',
  );
  line(
    '.env.integration file',
    existsSync(integrationFile) ? 'PASS' : 'FAIL',
    existsSync(integrationFile)
      ? 'integration-test configuration present'
      : 'run pnpm env:setup:integration',
  );

  const { env, file } = loadIntegrationEnv(rootDir);
  if (!file.present) {
    line('INTEGRATION_DATABASE_URL', 'FAIL', 'create .env.integration first');
    line(
      'INTEGRATION_REDIS_URL',
      checkpointMode ? 'DEFERRED' : 'FAIL',
      'create .env.integration first',
    );
  } else {
    line(
      'INTEGRATION_* keys loaded from file',
      'PASS',
      `${String(file.loaded)} INTEGRATION_ variable(s); application DATABASE_URL/REDIS_URL not loaded`,
    );
  }

  const database = validateIntegrationDatabaseUrl(env['INTEGRATION_DATABASE_URL']);
  line(
    'INTEGRATION_DATABASE_URL',
    database.ok ? 'PASS' : 'FAIL',
    database.ok
      ? `format ok; host ${database.host} port ${String(database.port)} database ${database.database}`
      : database.message,
  );

  const redis = validateIntegrationRedisUrl(env['INTEGRATION_REDIS_URL']);
  line(
    'INTEGRATION_REDIS_URL',
    redis.ok ? 'PASS' : 'FAIL',
    redis.ok
      ? `format ok; host ${redis.host} port ${String(redis.port)} index ${redis.databaseIndex}`
      : redis.message,
  );

  let postgresPortOpen = false;
  let redisPortOpen = false;
  let postgresLoginOk = false;

  if (database.ok) {
    postgresPortOpen = await probeTcp(database.host, database.port);
    line(
      'PostgreSQL port',
      postgresPortOpen ? 'PASS' : 'FAIL',
      postgresPortOpen
        ? 'TCP connect succeeded'
        : 'start local PostgreSQL or fix host/port in .env.integration',
    );
  } else {
    line('PostgreSQL port', 'NOT RUN', 'fix INTEGRATION_DATABASE_URL first');
  }

  if (redis.ok) {
    redisPortOpen = await probeTcp(redis.host, redis.port);
    if (redisPortOpen) {
      line('Redis port', 'PASS', 'TCP connect succeeded');
    } else if (checkpointMode) {
      line(
        'Redis port',
        'DEFERRED',
        'Redis is configured but not running; live Redis integration is postponed',
      );
    } else {
      line(
        'Redis port',
        'FAIL',
        'start Redis (docker compose -f docker-compose.test.yml up -d or local Redis on 6379/6380)',
      );
    }
  } else if (checkpointMode && !file.present) {
    line(
      'Redis port',
      'DEFERRED',
      'integration file missing; configure Redis before full verification',
    );
  } else if (!redis.ok) {
    line('Redis port', 'NOT RUN', 'fix INTEGRATION_REDIS_URL first');
  }

  if (database.ok) {
    const probe = spawnSync(process.execPath, [path.join(scriptDir, 'probe-postgres.mjs')], {
      cwd: rootDir,
      env: { ...process.env, DATABASE_URL: env['INTEGRATION_DATABASE_URL'] },
      encoding: 'utf8',
    });
    postgresLoginOk = probe.status === 0;
    line(
      'PostgreSQL login',
      postgresLoginOk ? 'PASS' : 'FAIL',
      postgresLoginOk
        ? (probe.stdout ?? '').trim()
        : 'check username, URL-encoded password, and database softtech_test',
    );
  } else {
    line('PostgreSQL login', 'NOT RUN', 'fix INTEGRATION_DATABASE_URL first');
  }

  if (existsSync(path.join(rootDir, 'package.json'))) {
    line('workspace scripts', 'PASS', REQUIRED_ROOT_SCRIPTS.join(', '));
  }

  const docker = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
    shell: true,
    encoding: 'utf8',
  });
  line(
    'Docker CLI',
    docker.status === 0 ? 'PASS' : checkpointMode ? 'DEFERRED' : 'NOT RUN',
    docker.status === 0
      ? 'available for test Redis and image builds'
      : 'not installed; required later for Docker-based test Redis and image builds',
  );

  process.stdout.write(
    '\nThis command inspects configuration only. It does not run migrations or modify databases.\n',
  );
  process.stdout.write('Passwords and full connection URLs are never printed.\n');
  if (checkpointMode) {
    process.stdout.write(
      'DEFERRED means the check is intentionally postponed until its dependency is available.\n',
    );
  }

  let exitCode = 0;
  if (!existsSync(envFile) || !existsSync(integrationFile) || !file.present) {
    exitCode = 1;
  }
  if (!database.ok || !redis.ok) {
    exitCode = 1;
  }
  if (database.ok && (!postgresPortOpen || !postgresLoginOk)) {
    exitCode = 1;
  }
  if (!checkpointMode && redis.ok && !redisPortOpen) {
    exitCode = 1;
  }
  process.exit(exitCode);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'env:check failed'}\n`);
  process.exit(1);
});
