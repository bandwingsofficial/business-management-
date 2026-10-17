import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

/** @type {readonly { readonly name: string; readonly command: string }[]} */
const STEPS = [
  { name: 'Strict environment diagnostic', command: 'pnpm env:check' },
  { name: 'Integration tests', command: 'pnpm test:integration' },
];

function main() {
  process.stdout.write('Softtech Core full infrastructure verification\n');
  process.stdout.write('Requires live PostgreSQL softtech_test and Redis database index 15.\n\n');

  for (const step of STEPS) {
    process.stdout.write(`==> ${step.name}\n`);
    const result = spawnSync(step.command, {
      cwd: rootDir,
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });
    if (result.status !== 0) {
      process.stderr.write(`\nInfrastructure verification failed at: ${step.name}\n`);
      process.exit(result.status ?? 1);
    }
    process.stdout.write('\n');
  }

  process.stdout.write(
    'Integration and strict env checks passed. Docker image builds are still a separate CI/local docker build step.\n',
  );
  process.exit(0);
}

main();
