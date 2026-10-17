import { describe, expect, it } from 'vitest';

import { AuthenticationError, NotFoundError } from '@/common/errors/application-error';

import { authorizeMetrics, MetricsRegistry } from './metrics';

describe('metrics protection', () => {
  it('stays hidden without a token and rejects a wrong token', () => {
    expect(() => authorizeMetrics(undefined, undefined)).toThrow(NotFoundError);
    expect(() => authorizeMetrics('metrics-token-value', 'Bearer wrong-token-value')).toThrow(
      AuthenticationError,
    );
    expect(() =>
      authorizeMetrics('metrics-token-value', 'Bearer metrics-token-value'),
    ).not.toThrow();
  });

  it('renders counters without tenant labels', () => {
    const registry = new MetricsRegistry();
    registry.increment('http_requests_total', { method: 'GET', route: '/health', status: '200' });
    const body = registry.render();
    expect(body).toContain('http_requests_total{method="GET",route="/health",status="200"} 1');
    expect(body).toContain('process_resident_memory_bytes');
    expect(body).not.toContain('organization');
  });
});
