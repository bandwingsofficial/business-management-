import { describe, expect, it } from 'vitest';

import { getAppTitle } from '@/lib/app-meta';

describe('app meta', () => {
  it('exposes the product title', () => {
    expect(getAppTitle()).toBe('Softtech Core');
  });
});
