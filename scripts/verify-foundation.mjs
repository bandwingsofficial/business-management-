import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

/** @type {readonly { readonly name: string; readonly command: string }[]} */
const STEPS = [
  { name: 'Environment checkpoint', command: 'pnpm env:check:checkpoint' },
  { name: 'PostgreSQL verify', command: 'pnpm db:verify-postgres' },
  { name: 'Prisma migrate status', command: 'pnpm db:migrate:status' },
  { name: 'Format check', command: 'pnpm format:check' },
  { name: 'Lint', command: 'pnpm lint' },
  { name: 'Typecheck', command: 'pnpm typecheck' },
  { name: 'Unit tests', command: 'pnpm test:unit' },
  { name: 'API E2E tests', command: 'pnpm test:e2e' },
  { name: 'Architecture boundaries', command: 'pnpm check:architecture' },
  { name: 'Build', command: 'pnpm build' },
  { name: 'Dependency audit', command: 'pnpm audit:deps' },
  { name: 'Secret scan', command: 'pnpm scan:secrets' },
  { name: 'License check', command: 'pnpm check:licenses' },
];

function runStep(step) {
  const result = spawnSync(step.command, {
    cwd: rootDir,
    shell: true,
    encoding: 'utf8',
    env: process.env,
  });
  const status = result.status === 0 ? 'PASS' : 'FAIL';
  return { ...step, status, exitCode: result.status ?? 1 };
}

function main() {
  process.stdout.write('Softtech Core foundation checkpoint verification\n');
  process.stdout.write('Redis live integration is deferred in this workflow.\n\n');

  const results = STEPS.map(runStep);
  for (const result of results) {
    process.stdout.write(`${result.name}: ${result.status}\n`);
  }

  process.stdout.write('\nDeferred (run verify:infrastructure when Redis is available):\n');
  process.stdout.write('- Redis cache TTL, invalidation, and tenant key integration\n');
  process.stdout.write('- Shared Redis auth rate limiting integration\n');
  process.stdout.write('- Full platform.integration.spec.ts suite\n');
  process.stdout.write('- Docker image builds\n');
  process.stdout.write(
    '\nUse pnpm verify:infrastructure for strict service checks and pnpm test:integration for the full suite.\n',
  );

  const failed = results.filter((item) => item.status === 'FAIL');
  if (failed.length > 0) {
    process.stderr.write(`\nFoundation checkpoint failed (${String(failed.length)} step(s)).\n`);
    process.exit(1);
  }

  process.stdout.write('\nFoundation checkpoint passed. Production readiness is not granted.\n');
  process.exit(0);
}

main();
