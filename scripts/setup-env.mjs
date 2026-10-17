import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {{ readonly rootDir: string; readonly templateName: string; readonly targetName: string }} input
 */
export function planEnvFileSetup(input) {
  const templatePath = path.join(input.rootDir, input.templateName);
  const targetPath = path.join(input.rootDir, input.targetName);

  if (!existsSync(templatePath)) {
    return {
      ok: false,
      created: false,
      targetPath,
      message: `Missing template ${input.templateName} at the repository root.`,
    };
  }

  if (existsSync(targetPath)) {
    return {
      ok: true,
      created: false,
      targetPath,
      message: `${input.targetName} already exists and was not changed. Edit ${input.targetName} with your local values.`,
    };
  }

  copyFileSync(templatePath, targetPath);
  return {
    ok: true,
    created: true,
    targetPath,
    message: `Created ${input.targetName} from ${input.templateName}. Edit ${input.targetName} with your local values.`,
  };
}

function main() {
  const rootDir = path.resolve(scriptDir, '..');
  const integration = process.argv.includes('--integration');
  const result = planEnvFileSetup(
    integration
      ? {
          rootDir,
          templateName: '.env.integration.example',
          targetName: '.env.integration',
        }
      : {
          rootDir,
          templateName: '.env.example',
          targetName: '.env',
        },
  );

  process.stdout.write(`${result.message}\n`);
  if (!result.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
