import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { resolveCorrelationId } from './correlation-id';
import { requestContext } from './request-context';
import { readTraceParent } from './traceparent';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  public use(request: Request, response: Response, next: NextFunction): void {
    const requestId = resolveCorrelationId(request.header('x-request-id'));
    const trace = readTraceParent(request.header('traceparent'));
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);
    requestContext.run(
      {
        requestId,
        ...(trace === undefined ? {} : { traceId: trace.traceId, spanId: trace.spanId }),
      },
      () => {
        next();
      },
    );
  }
}
