import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ALIAS = /((?:require|from)\s*\(\s*|from\s+)(["'])@\/([^"']+)\2/g;

export function rewriteAliasSpecifier(fromFile, specifier, distRoot) {
  const target = path.resolve(distRoot, specifier);
  let relative = path.relative(path.dirname(fromFile), target);
  relative = relative.split(path.sep).join('/');
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }
  if (!relative.endsWith('.js')) {
    relative = `${relative}.js`;
  }
  return relative;
}

export function rewriteSource(source, fromFile, distRoot) {
  return source.replace(ALIAS, (_match, prefix, quote, specifier) => {
    return `${prefix}${quote}${rewriteAliasSpecifier(fromFile, specifier, distRoot)}${quote}`;
  });
}

export function rewriteDist(distRoot) {
  let changed = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith('.js')) {
        continue;
      }
      const source = readFileSync(full, 'utf8');
      const next = rewriteSource(source, full, distRoot);
      if (next !== source) {
        writeFileSync(full, next);
        changed += 1;
      }
    }
  };
  walk(distRoot);
  return changed;
}

if (process.argv[1]?.endsWith('rewrite-aliases.mjs')) {
  const dist = path.resolve(process.argv[2] ?? 'dist');
  const changed = rewriteDist(dist);
  process.stdout.write(`rewrote aliases in ${String(changed)} files\n`);
}
