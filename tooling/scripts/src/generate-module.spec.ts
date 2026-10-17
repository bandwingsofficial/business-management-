import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const generatorPath = path.join(repoRoot, 'tooling', 'scripts', 'src', 'generate-module.mjs');
const tscPath = require.resolve('typescript/bin/tsc');
const directories: string[] = [];

function generate(
  args: readonly string[],
  cwd = repoRoot,
): { status: number | null; stderr: string } {
  const result = spawnSync(process.execPath, [generatorPath, ...args], {
    cwd,
    encoding: 'utf8',
  });
  return { status: result.status, stderr: result.stderr };
}

function typecheck(directory: string): { status: number | null; stdout: string; stderr: string } {
  const tsconfigPath = path.join(directory, 'tsconfig.json');
  const result = spawnSync(
    process.execPath,
    [tscPath, '--noEmit', '--pretty', 'false', '-p', tsconfigPath],
    { cwd: directory, encoding: 'utf8' },
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function writeTypecheckConfig(directory: string): void {
  const contents = {
    compilerOptions: {
      strict: true,
      target: 'ES2022',
      module: 'commonjs',
      moduleResolution: 'bundler',
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
      noUncheckedIndexedAccess: true,
      types: ['node'],
    },
    include: ['./**/*.ts'],
  };
  writeFileSync(path.join(directory, 'tsconfig.json'), `${JSON.stringify(contents, null, 2)}\n`);
}

function createTarget(name: string): string {
  const tempRoot = path.join(repoRoot, 'apps', 'api', '.generator-tmp');
  mkdirSync(tempRoot, { recursive: true });
  const directory = mkdtempSync(path.join(tempRoot, 'module-'));
  directories.push(directory);
  return path.join(directory, name);
}

describe('module generator', () => {
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('generates a compiling module without empty domain classes', () => {
    const target = createTarget('billing-accounts');

    const result = generate(['--name', 'billing-accounts', '--target', target]);
    expect(result.status).toBe(0);

    const moduleSource = readFileSync(path.join(target, 'billing-accounts.module.ts'), 'utf8');
    expect(moduleSource).toContain('@Module({})');
    expect(moduleSource).not.toContain('providers:');
    expect(existsSync(path.join(target, 'domain'))).toBe(false);
    expect(existsSync(path.join(target, 'infrastructure'))).toBe(false);
    expect(existsSync(path.join(target, 'presentation'))).toBe(false);
    expect(readFileSync(path.join(target, 'index.ts'), 'utf8')).toContain('BillingAccountsModule');

    writeTypecheckConfig(target);
    const checked = typecheck(target);
    expect(checked.status, `${checked.stdout}\n${checked.stderr}`).toBe(0);
  });

  it('generates compiling command and query files only for the requested actions', () => {
    const target = createTarget('billing-accounts');

    const result = generate([
      '--name',
      'billing-accounts',
      '--command',
      'create-account',
      '--query',
      'get-account',
      '--target',
      target,
    ]);
    expect(result.status).toBe(0);
    expect(
      readFileSync(
        path.join(target, 'application', 'commands', 'create-account', 'create-account.handler.ts'),
        'utf8',
      ),
    ).toContain('class CreateAccountHandler');
    expect(
      readFileSync(
        path.join(target, 'application', 'queries', 'get-account', 'get-account.handler.ts'),
        'utf8',
      ),
    ).toContain('class GetAccountHandler');
    expect(readFileSync(path.join(target, 'billing-accounts.module.ts'), 'utf8')).toContain(
      'providers: [CreateAccountHandler, GetAccountHandler]',
    );

    writeTypecheckConfig(target);
    const checked = typecheck(target);
    expect(checked.status, `${checked.stdout}\n${checked.stderr}`).toBe(0);

    const overwrite = generate(['--name', 'billing-accounts', '--target', target]);
    expect(overwrite.status).not.toBe(0);
    expect(overwrite.stderr).toMatch(/Refusing to overwrite/);
  });

  it('rejects a name that is not kebab-case', () => {
    const result = generate(['--name', 'BillingAccounts', '--target', createTarget('bad')]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/kebab-case/);
  });
});
