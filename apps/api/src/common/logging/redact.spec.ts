import { describe, expect, it } from 'vitest';

import { redactSecrets } from './redact';

describe('redactSecrets', () => {
  it('masks connection strings and credential fields', () => {
    const redacted = redactSecrets({
      database: { url: 'postgresql://softtech:super-secret-password@localhost/softtech' },
      redis: { url: 'redis://localhost:6379' },
      storage: { secretAccessKey: 'super-secret-password', bucket: 'files' },
      email: { password: 'super-secret-password', host: 'localhost' },
      http: { port: 3001 },
    });

    expect(JSON.stringify(redacted)).not.toContain('super-secret-password');
    expect(JSON.stringify(redacted)).not.toContain('postgresql://');
    expect(redacted.storage.bucket).toBe('files');
    expect(redacted.email.host).toBe('localhost');
    expect(redacted.http.port).toBe(3001);
  });
});
