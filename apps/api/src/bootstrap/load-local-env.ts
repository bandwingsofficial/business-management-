import { existsSync } from 'node:fs';
import path from 'node:path';

import { config as loadDotenv } from 'dotenv';

const packageRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(packageRoot, '../..');

/**
 * Loads .env files for local runs. Existing process environment wins.
 * A package-level file wins over the repository root file.
 */
export function loadLocalEnv(): void {
  if (process.env['NODE_ENV'] === 'test') {
    return;
  }

  const packageEnv = path.join(packageRoot, '.env');
  const rootEnv = path.join(repoRoot, '.env');

  if (existsSync(packageEnv)) {
    loadDotenv({ path: packageEnv });
  }
  if (existsSync(rootEnv)) {
    loadDotenv({ path: rootEnv });
  }
}
