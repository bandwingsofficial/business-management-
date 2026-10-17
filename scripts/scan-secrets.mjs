import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const blocked = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/ },
  { name: 'cloud access key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'live payment key', pattern: /sk_live_[0-9a-zA-Z]{8,}/ },
];

const files = listFiles().filter((file) => file !== 'pnpm-lock.yaml' && !file.endsWith('.lock'));

const findings = [];
for (const file of files) {
  if (file === '.env' || file.endsWith('/.env')) {
    findings.push(`${file}: tracked environment file`);
    continue;
  }
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const rule of blocked) {
    if (rule.pattern.test(text)) {
      findings.push(`${file}: ${rule.name}`);
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(`${findings.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`secret scan checked ${String(files.length)} files\n`);

function listFiles() {
  try {
    return execFileSync('git', ['ls-files'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split(/\r?\n/)
      .filter((file) => file.length > 0);
  } catch {
    return walk('.');
  }
}

function isLocalEnvFile(relativePath) {
  const name = path.basename(relativePath);
  return name === '.env' || name === '.env.integration' || name.startsWith('.env.');
}

function walk(directory) {
  const skip = new Set([
    'node_modules',
    'dist',
    '.next',
    'coverage',
    'generated',
    '.git',
    '.turbo',
  ]);
  return readdirSync(directory).flatMap((entry) => {
    if (skip.has(entry)) {
      return [];
    }
    const fullPath = path.join(directory, entry);
    const relativePath = fullPath.split(path.sep).join('/');
    if (statSync(fullPath).isDirectory()) {
      return walk(fullPath);
    }
    if (isLocalEnvFile(relativePath)) {
      return [];
    }
    return [relativePath];
  });
}
