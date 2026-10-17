import { spawnSync } from 'node:child_process';

const listed = spawnSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
  encoding: 'utf8',
  shell: true,
  maxBuffer: 32 * 1024 * 1024,
});
if (listed.status !== 0) {
  process.stderr.write(listed.stderr || 'license list failed\n');
  process.exit(listed.status ?? 1);
}
const raw = listed.stdout;
const report = JSON.parse(raw);
const blocked = [];
const notices = [];

for (const [license, packages] of Object.entries(report)) {
  for (const item of packages) {
    const label = `${item.name}@${(item.versions ?? []).join(',')} ${license}`;
    if (isBlocked(license)) {
      blocked.push(label);
    } else if (/LGPL/i.test(license)) {
      notices.push(label);
    }
  }
}

if (notices.length > 0) {
  process.stdout.write(`LGPL notices for review:\n${notices.join('\n')}\n`);
}

if (blocked.length > 0) {
  process.stderr.write(`${blocked.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`production license check found no AGPL, SSPL, or GPL-3.0-only packages\n`);

function isBlocked(license) {
  if (/AGPL|SSPL/i.test(license)) {
    return true;
  }
  return /(^|[^L])GPL-3\.0/i.test(license) && !/\bOR\b/.test(license);
}
