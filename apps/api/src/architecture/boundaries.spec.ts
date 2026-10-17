import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const depcruiseBin = path.join(
  process.cwd(),
  'node_modules',
  'dependency-cruiser',
  'bin',
  'dependency-cruiser.mjs',
);

const apiRoot = process.cwd();
const directories: string[] = [];

function write(root: string, relativePath: string, contents: string): void {
  const filePath = path.join(root, ...relativePath.split('/'));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

describe('architecture boundaries', () => {
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('flags layer and cross-module violations and allows the public module API', () => {
    const tempRoot = path.join(apiRoot, '.generator-tmp');
    mkdirSync(tempRoot, { recursive: true });
    const fixture = mkdtempSync(path.join(tempRoot, 'architecture-'));
    directories.push(fixture);

    write(
      fixture,
      'tsconfig.json',
      `${JSON.stringify({ compilerOptions: { strict: true, baseUrl: '.' } }, null, 2)}\n`,
    );
    write(
      fixture,
      'src/modules/orders/domain/order.ts',
      'export interface Order { readonly id: string }\n',
    );
    write(
      fixture,
      'src/modules/orders/application/place-order.handler.ts',
      "import type { Order } from '../domain/order';\nexport class PlaceOrderHandler { public readonly order?: Order; }\n",
    );
    write(
      fixture,
      'src/modules/orders/presentation/http/orders.controller.ts',
      "import { PlaceOrderHandler } from '../../application/place-order.handler';\nexport class OrdersController { public readonly handler = PlaceOrderHandler; }\n",
    );
    write(
      fixture,
      'src/modules/orders/orders.module.ts',
      "import { Module } from '@nestjs/common';\nimport { PlaceOrderHandler } from './application/place-order.handler';\n@Module({})\nexport class OrdersModule { public readonly handler = PlaceOrderHandler; }\n",
    );
    write(
      fixture,
      'src/modules/orders/index.ts',
      "export { OrdersModule } from './orders.module';\n",
    );
    write(
      fixture,
      'src/modules/shipping/public-api-use.ts',
      "import { OrdersModule } from '../orders';\nexport const publicOrders = OrdersModule;\n",
    );
    write(
      fixture,
      'src/modules/shipping/shipping.module.ts',
      "import { OrdersModule } from '../orders/orders.module';\nexport class ShippingModule { public readonly orders = OrdersModule; }\n",
    );
    write(
      fixture,
      'src/infrastructure/database/database.module.ts',
      'export class DatabaseModule {}\n',
    );
    write(fixture, 'src/platform/health/health.module.ts', 'export class HealthModule {}\n');
    write(
      fixture,
      'src/modules/bad/application/create-account.handler.ts',
      "import { DatabaseModule } from '../../../infrastructure/database/database.module';\nexport class CreateAccountHandler { public readonly module = DatabaseModule; }\n",
    );
    write(
      fixture,
      'src/modules/bad/domain/account.ts',
      "import { Injectable } from '@nestjs/common';\nimport { CreateAccountHandler } from '../application/create-account.handler';\nexport const marker = Injectable;\nexport type Handler = CreateAccountHandler;\n",
    );
    write(
      fixture,
      'src/modules/bad/presentation/http/bad.controller.ts',
      "import { CreateAccountHandler } from '../../application/create-account.handler';\nimport type { Handler } from '../../domain/account';\nexport class BadController { public readonly handler = CreateAccountHandler; public readonly type?: Handler; }\n",
    );
    write(
      fixture,
      'src/common/leak.ts',
      "import { HealthModule } from '../platform/health/health.module';\nexport const leak = HealthModule;\n",
    );

    const result = spawnSync(
      process.execPath,
      [
        depcruiseBin,
        'src',
        '--config',
        path.join(apiRoot, '.dependency-cruiser.cjs'),
        '--output-type',
        'json',
      ],
      { cwd: fixture, encoding: 'utf8' },
    );
    const stdout = result.stdout;
    expect(stdout.length, result.stderr).toBeGreaterThan(0);

    const parsed = JSON.parse(stdout) as {
      summary?: { violations?: Array<{ rule?: { name?: string } }> };
    };
    const names = (parsed.summary?.violations ?? []).map((violation) => violation.rule?.name ?? '');

    expect(names).toEqual(
      expect.arrayContaining([
        'domain-stays-inside-the-domain',
        'domain-does-not-import-frameworks',
        'application-does-not-import-outer-layers',
        'presentation-does-not-import-infrastructure-or-domain',
        'common-does-not-import-product-code',
        'no-cross-module-internals',
      ]),
    );
    expect(names).toHaveLength(6);
  });
});
