import { describe, expect, it } from 'vitest';

import { normalizePageRequest } from './page-request';

describe('normalizePageRequest', () => {
  it('applies defaults', () => {
    expect(normalizePageRequest(undefined)).toEqual({ page: 1, pageSize: 20 });
  });

  it('rejects a page size above the maximum', () => {
    expect(() => normalizePageRequest({ page: 1, pageSize: 101 })).toThrow(/pageSize/);
  });

  it('rejects a non-positive page and a non-integer page size', () => {
    expect(() => normalizePageRequest({ page: 0, pageSize: 20 })).toThrow(/page/);
    expect(() => normalizePageRequest({ page: 1, pageSize: 1.5 })).toThrow(/pageSize/);
  });
});
