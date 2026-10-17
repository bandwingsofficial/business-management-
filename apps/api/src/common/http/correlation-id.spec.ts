import { describe, expect, it } from 'vitest';

import { resolveCorrelationId } from './correlation-id';

describe('resolveCorrelationId', () => {
  it('keeps a safe incoming id', () => {
    expect(resolveCorrelationId('req-123')).toBe('req-123');
  });

  it('replaces missing or unsafe header values', () => {
    expect(resolveCorrelationId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(resolveCorrelationId('bad id')).not.toBe('bad id');
    expect(resolveCorrelationId('line\r\nbreak')).not.toContain('\n');
  });
});
