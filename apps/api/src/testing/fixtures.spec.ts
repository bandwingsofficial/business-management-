import { describe, expect, it } from 'vitest';

import { assertIsolatedDatabase, assertIsolatedRedis, isolatedRecords } from './fixtures';

describe('integration fixtures', () => {
  it('builds distinct tenant identifiers', () => {
    const records = isolatedRecords();
    expect(records.organizationA).not.toBe(records.organizationB);
    expect(records.userA).not.toBe(records.userB);
  });

  it('accepts only the local test database and redis index', () => {
    expect(
      assertIsolatedDatabase('postgresql://softtech:softtech@127.0.0.1:5433/softtech_test'),
    ).toContain('softtech_test');
    expect(() =>
      assertIsolatedDatabase('postgresql://softtech:softtech@db.internal:5432/softtech'),
    ).toThrow(/host db.internal is not allowed/);
    expect(assertIsolatedRedis('redis://127.0.0.1:6380/15')).toContain('/15');
    expect(() => assertIsolatedRedis('redis://127.0.0.1:6379/0')).toThrow(
      /database index must be 15/,
    );
  });
});
