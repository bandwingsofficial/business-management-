const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceParent {
  readonly traceId: string;
  readonly spanId: string;
}

export function readTraceParent(header: string | undefined): TraceParent | undefined {
  if (header === undefined) {
    return undefined;
  }
  const match = TRACEPARENT.exec(header.trim());
  if (!match) {
    return undefined;
  }
  const traceId = match[1];
  const spanId = match[2];
  if (traceId === undefined || spanId === undefined) {
    return undefined;
  }
  if (/^0+$/.test(traceId) || /^0+$/.test(spanId)) {
    return undefined;
  }
  return { traceId, spanId };
}
