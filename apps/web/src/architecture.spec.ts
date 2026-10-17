import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('web bundle boundaries', () => {
  it('does not import server-only packages', () => {
    const root = path.join(process.cwd(), 'src');
    const source = readTree(root);
    expect(source).not.toMatch(/@nestjs\/|@prisma\/|prisma|ioredis|pg\b/);
  });
});

function readTree(directory: string): string {
  return readdirSync(directory)
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry);
      if (statSync(fullPath).isDirectory()) {
        return [readTree(fullPath)];
      }
      if (entry === 'architecture.spec.ts') {
        return [];
      }
      return fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')
        ? [readFileSync(fullPath, 'utf8')]
        : [];
    })
    .join('\n');
}
