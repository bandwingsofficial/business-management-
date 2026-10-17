import { describe, expect, it } from 'vitest';

import { ApplicationError } from './application-error';

describe('ApplicationError', () => {
  it('keeps a stable code separate from the message', () => {
    const error = new ApplicationError('example.not_ready', 'Example is not ready', {
      feature: 'example',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApplicationError');
    expect(error.code).toBe('example.not_ready');
    expect(error.details).toEqual({ feature: 'example' });
  });
});
