import { describe, expect, it } from 'vitest';

import { requestContext } from '@/common/http/request-context';

import { StructuredLogger } from './structured-logger';

describe('structured logger', () => {
  it('writes json and redacts secret fields', () => {
    const lines: string[] = [];
    const logger = new StructuredLogger(
      { env: 'production', level: 'info', serviceName: 'Softtech Core', json: true },
      {
        write(line: string): void {
          lines.push(line);
        },
      },
    );

    requestContext.run({ requestId: 'req-log', traceId: 'trace-1' }, () => {
      logger.record('info', 'request completed', {
        authorization: 'Bearer super-secret-password',
        route: '/api/v1/health',
      });
    });

    const record = JSON.parse(lines[0] ?? '{}') as {
      requestId?: string;
      fields?: { authorization?: string };
    };
    expect(record.requestId).toBe('req-log');
    expect(record.fields?.authorization).toBe('[redacted]');
    expect(lines[0]).not.toContain('super-secret-password');
  });
});
