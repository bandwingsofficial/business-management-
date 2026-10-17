import { describe, expect, it } from 'vitest';

import { DatabaseModule } from './database.module';
import { requireDatabaseUrl } from './database-url';

describe('database adapter', () => {
  it('rejects a missing or non-postgres url without echoing it', () => {
    expect(() => requireDatabaseUrl(undefined)).toThrow(/DATABASE_URL is required/);

    try {
      requireDatabaseUrl('mysql://user:super-secret-password@localhost/db');
    } catch (error) {
      expect((error as Error).message).toBe('DATABASE_URL must be a postgresql connection string');
      expect((error as Error).message).not.toContain('super-secret-password');
    }
  });

  it('exposes the module for later composition', () => {
    expect(DatabaseModule).toBeDefined();
    expect(requireDatabaseUrl('postgresql://localhost/softtech')).toBe(
      'postgresql://localhost/softtech',
    );
  });
});
