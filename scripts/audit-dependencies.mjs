import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const reviewed = JSON.parse(
  readFileSync(new URL('../security/reviewed-advisories.json', import.meta.url), 'utf8'),
);
const audit = spawnSync('pnpm', ['audit', '--json'], { encoding: 'utf8', shell: true });
const raw = `${audit.stdout ?? ''}${audit.stderr ?? ''}`;
if (audit.error) {
  process.stderr.write(`${audit.error.message}\n`);
  process.exit(1);
}

const jsonStart = raw.indexOf('{');
const report = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart) : raw);
const advisories = Object.values(report.advisories ?? {});
const unreviewed = [];

for (const advisory of advisories) {
  const known = reviewed.advisories.find(
    (entry) => entry.github_advisory_id === advisory.github_advisory_id,
  );
  const paths = (advisory.findings ?? []).flatMap((finding) => finding.paths ?? []);
  if (!known) {
    unreviewed.push(`${advisory.severity} ${advisory.github_advisory_id} ${advisory.module_name}`);
    continue;
  }
  if (paths.some((item) => !item.includes(known.pathIncludes))) {
    unreviewed.push(`${advisory.github_advisory_id} is present outside ${known.pathIncludes}`);
  } else {
    process.stdout.write(
      `reviewed ${advisory.github_advisory_id} ${advisory.module_name}: still reported, no patch\n`,
    );
  }
}

if (unreviewed.length > 0) {
  process.stderr.write(`${unreviewed.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('dependency audit has no unreviewed high or critical advisories\n');
