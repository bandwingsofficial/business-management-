import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { applyIntegrationEnvFile } from '../../../../scripts/integration-env-file.mjs';
import { planEnvFileSetup } from '../../../../scripts/setup-env.mjs';

describe('environment setup scripts', () => {
  it('creates .env from the template only when missing', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'softtech-env-'));
    try {
      writeFileSync(path.join(root, '.env.example'), 'NODE_ENV=development\n', 'utf8');
      const first = planEnvFileSetup({
        rootDir: root,
        templateName: '.env.example',
        targetName: '.env',
      });
      expect(first.created).toBe(true);
      expect(readFileSync(path.join(root, '.env'), 'utf8')).toBe('NODE_ENV=development\n');

      const second = planEnvFileSetup({
        rootDir: root,
        templateName: '.env.example',
        targetName: '.env',
      });
      expect(second.created).toBe(false);
      expect(second.message).toMatch(/already exists/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads only INTEGRATION_* keys from an integration env file', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'softtech-int-'));
    try {
      const filePath = path.join(root, '.env.integration');
      writeFileSync(
        filePath,
        [
          'DATABASE_URL=postgresql://must-not-load',
          'INTEGRATION_DATABASE_URL=postgresql://softtech:softtech@127.0.0.1:5433/softtech_test',
          'INTEGRATION_REDIS_URL=redis://127.0.0.1:6380/15',
        ].join('\n'),
        'utf8',
      );
      const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' };
      const result = applyIntegrationEnvFile(filePath, env);
      expect(result.loaded).toBe(2);
      expect(env['INTEGRATION_DATABASE_URL']).toContain('softtech_test');
      expect(env['DATABASE_URL']).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
