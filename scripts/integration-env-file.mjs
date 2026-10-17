import { existsSync, readFileSync } from 'node:fs';

/**
 * @param {string} filePath
 * @param {NodeJS.ProcessEnv} target
 */
export function applyIntegrationEnvFile(filePath, target) {
  if (!existsSync(filePath)) {
    return { loaded: 0, present: false };
  }

  const content = readFileSync(filePath, 'utf8');
  let loaded = 0;
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key.startsWith('INTEGRATION_')) {
      continue;
    }
    target[key] = value;
    loaded += 1;
  }
  return { loaded, present: true };
}

/**
 * @param {string} rootDir
 */
export function loadIntegrationEnv(rootDir) {
  const path = `${rootDir}/.env.integration`.replace(/\\/g, '/');
  const env = {};
  const file = applyIntegrationEnvFile(path, env);
  return { path, file, env };
}
