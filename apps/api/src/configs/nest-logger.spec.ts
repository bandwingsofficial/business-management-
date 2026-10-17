import { describe, expect, it } from 'vitest';

import { nestLoggerLevels } from './nest-logger';

describe('nestLoggerLevels', () => {
  it('includes levels up to the configured threshold', () => {
    expect(nestLoggerLevels('error')).toEqual(['fatal', 'error']);
    expect(nestLoggerLevels('info')).toEqual(['fatal', 'error', 'warn', 'log']);
  });
});
