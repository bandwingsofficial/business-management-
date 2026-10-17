import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function printUsage() {
  process.stderr.write(
    [
      'Usage: pnpm generate:module -- --name <kebab-name> [--command <action>]... [--query <action>]... [--target <dir>]',
      '',
      'Generates a compiling NestJS module scaffold. It does not create empty domain classes.',
      'Replace generated handler bodies with the real use case before shipping the module.',
      '',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const result = {
    name: undefined,
    commands: [],
    queries: [],
    target: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--help' || token === '-h') {
      result.help = true;
      continue;
    }

    if (token === '--name' || token === '--target') {
      if (!next || next.startsWith('--')) {
        throw new Error(`${token} requires a value`);
      }
      if (token === '--name') {
        result.name = next;
      } else {
        result.target = next;
      }
      index += 1;
      continue;
    }

    if (token === '--command' || token === '--query') {
      if (!next || next.startsWith('--')) {
        throw new Error(`${token} requires a value`);
      }
      if (token === '--command') {
        result.commands.push(next);
      } else {
        result.queries.push(next);
      }
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return result;
}

function assertKebab(value, label) {
  if (!KEBAB_CASE.test(value)) {
    throw new Error(`${label} must be kebab-case. Received: ${value}`);
  }
}

function toPascal(kebab) {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function writeNewFile(filePath, contents) {
  writeFileSync(filePath, contents, { encoding: 'utf8', flag: 'wx' });
}

function commandFiles(action) {
  const typeName = toPascal(action);
  const folder = path.posix.join('application', 'commands', action);
  return [
    {
      relativePath: path.posix.join(folder, `${action}.command.ts`),
      contents: `export interface ${typeName}Command {\n  readonly requestedBy: string;\n}\n`,
    },
    {
      relativePath: path.posix.join(folder, `${action}.result.ts`),
      contents: `export interface ${typeName}Result {\n  readonly requestedBy: string;\n}\n`,
    },
    {
      relativePath: path.posix.join(folder, `${action}.handler.ts`),
      contents: `import type { ${typeName}Command } from './${action}.command';\nimport type { ${typeName}Result } from './${action}.result';\n\nexport class ${typeName}Handler {\n  public execute(command: ${typeName}Command): ${typeName}Result {\n    if (command.requestedBy.trim().length === 0) {\n      throw new Error('requestedBy is required');\n    }\n\n    return { requestedBy: command.requestedBy };\n  }\n}\n`,
    },
    {
      relativePath: path.posix.join(folder, `${action}.handler.spec.ts`),
      contents: `import { describe, expect, it } from 'vitest';\n\nimport { ${typeName}Handler } from './${action}.handler';\n\ndescribe('${typeName}Handler', () => {\n  const handler = new ${typeName}Handler();\n\n  it('returns the scaffold result for a command', () => {\n    expect(handler.execute({ requestedBy: 'user-1' })).toEqual({ requestedBy: 'user-1' });\n  });\n\n  it('rejects an empty requestedBy', () => {\n    expect(() => handler.execute({ requestedBy: ' ' })).toThrow(/requestedBy is required/);\n  });\n});\n`,
    },
  ];
}

function queryFiles(action) {
  const typeName = toPascal(action);
  const folder = path.posix.join('application', 'queries', action);
  return [
    {
      relativePath: path.posix.join(folder, `${action}.query.ts`),
      contents: `export interface ${typeName}Query {\n  readonly id: string;\n}\n`,
    },
    {
      relativePath: path.posix.join(folder, `${action}.result.ts`),
      contents: `export interface ${typeName}Result {\n  readonly id: string;\n}\n`,
    },
    {
      relativePath: path.posix.join(folder, `${action}.handler.ts`),
      contents: `import type { ${typeName}Query } from './${action}.query';\nimport type { ${typeName}Result } from './${action}.result';\n\nexport class ${typeName}Handler {\n  public execute(query: ${typeName}Query): ${typeName}Result {\n    if (query.id.trim().length === 0) {\n      throw new Error('id is required');\n    }\n\n    return { id: query.id };\n  }\n}\n`,
    },
    {
      relativePath: path.posix.join(folder, `${action}.handler.spec.ts`),
      contents: `import { describe, expect, it } from 'vitest';\n\nimport { ${typeName}Handler } from './${action}.handler';\n\ndescribe('${typeName}Handler', () => {\n  const handler = new ${typeName}Handler();\n\n  it('returns the scaffold result for a query', () => {\n    expect(handler.execute({ id: 'item-1' })).toEqual({ id: 'item-1' });\n  });\n\n  it('rejects an empty id', () => {\n    expect(() => handler.execute({ id: ' ' })).toThrow(/id is required/);\n  });\n});\n`,
    },
  ];
}

function moduleContents(moduleName, commands, queries) {
  const className = `${toPascal(moduleName)}Module`;
  const handlers = [
    ...commands.map((action) => ({
      className: `${toPascal(action)}Handler`,
      importPath: `./application/commands/${action}/${action}.handler`,
    })),
    ...queries.map((action) => ({
      className: `${toPascal(action)}Handler`,
      importPath: `./application/queries/${action}/${action}.handler`,
    })),
  ];

  const localImports = handlers.map(
    (handler) => `import { ${handler.className} } from '${handler.importPath}';`,
  );
  const imports = ["import { Module } from '@nestjs/common';", ...localImports];
  if (localImports.length > 0) {
    imports.splice(1, 0, '');
  }
  const providers =
    handlers.length === 0
      ? '@Module({})'
      : `@Module({\n  providers: [${handlers.map((handler) => handler.className).join(', ')}],\n})`;

  return `${imports.join('\n')}\n\n${providers}\nexport class ${className} {}\n`;
}

function moduleSpec(moduleName) {
  const className = `${toPascal(moduleName)}Module`;
  return `import { describe, expect, it } from 'vitest';\n\nimport { ${className} } from './${moduleName}.module';\n\ndescribe('${className}', () => {\n  it('is defined', () => {\n    expect(${className}).toBeDefined();\n    expect(${className}.name).toBe('${className}');\n  });\n});\n`;
}

export function buildModuleFiles(options) {
  assertKebab(options.name, 'Module name');
  for (const action of options.commands) {
    assertKebab(action, 'Command name');
  }
  for (const action of options.queries) {
    assertKebab(action, 'Query name');
  }

  const files = [
    ...options.commands.flatMap((action) => commandFiles(action)),
    ...options.queries.flatMap((action) => queryFiles(action)),
    {
      relativePath: `${options.name}.module.ts`,
      contents: moduleContents(options.name, options.commands, options.queries),
    },
    {
      relativePath: `${options.name}.module.spec.ts`,
      contents: moduleSpec(options.name),
    },
    {
      relativePath: 'index.ts',
      contents: `export { ${toPascal(options.name)}Module } from './${options.name}.module';\n`,
    },
  ];

  return files;
}

export function generateModule(options) {
  const files = buildModuleFiles(options);
  const directory = options.target
    ? path.resolve(options.target)
    : path.join(REPO_ROOT, 'apps', 'api', 'src', 'modules', options.name);

  if (existsSync(directory)) {
    throw new Error(`Refusing to overwrite ${directory}`);
  }

  mkdirSync(directory, { recursive: true });

  for (const file of files) {
    const filePath = path.join(directory, ...file.relativePath.split('/'));
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeNewFile(filePath, file.contents);
  }

  return { directory, files: files.map((file) => file.relativePath) };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.name) {
      printUsage();
      process.exit(args.help ? 0 : 1);
    }

    const generated = generateModule({
      name: args.name,
      commands: args.commands,
      queries: args.queries,
      target: args.target,
    });
    process.stdout.write(`Generated ${generated.files.length} files in ${generated.directory}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Module generation failed';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  main();
}
