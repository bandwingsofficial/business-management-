import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function resolveCorrelationId(headerValue: string | undefined): string {
  if (headerValue !== undefined && REQUEST_ID_PATTERN.test(headerValue)) {
    return headerValue;
  }
  return randomUUID();
}
