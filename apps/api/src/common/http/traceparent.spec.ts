import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { requestContext } from './request-context';
import { readTraceParent } from './traceparent';

describe('trace parent', () => {
  it('reads a valid traceparent and stores it with the request id', () => {
    const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    expect(readTraceParent(header)?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(readTraceParent('bad')).toBeUndefined();

    const middleware = new CorrelationIdMiddleware();
    const request = {
      header(name: string): string | undefined {
        if (name === 'traceparent') {
          return header;
        }
        return 'req-trace';
      },
      headers: {},
    } as Request;
    const response = {
      setHeader(): void {
        return;
      },
    } as unknown as Response;
    middleware.use(request, response, (() => {
      expect(requestContext.current()).toMatchObject({
        requestId: 'req-trace',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
      });
    }) as NextFunction);
  });
});
