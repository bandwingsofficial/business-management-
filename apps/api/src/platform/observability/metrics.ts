import { timingSafeEqual } from 'node:crypto';

import { AuthenticationError, NotFoundError } from '@/common/errors/application-error';

export class MetricsRegistry {
  private readonly counters = new Map<string, number>();

  public increment(name: string, labels: Readonly<Record<string, string>> = {}): void {
    const key = `${name}${formatLabels(labels)}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  public render(): string {
    const lines = [
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${String(process.memoryUsage().rss)}`,
    ];
    for (const [key, value] of this.counters) {
      lines.push(`${key} ${String(value)}`);
    }
    return `${lines.join('\n')}\n`;
  }
}

export function authorizeMetrics(
  configuredToken: string | undefined,
  header: string | undefined,
): void {
  if (configuredToken === undefined) {
    throw new NotFoundError();
  }
  const presented = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!safeEqual(configuredToken, presented)) {
    throw new AuthenticationError();
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function formatLabels(labels: Readonly<Record<string, string>>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return '';
  }
  return `{${entries.map(([key, value]) => `${key}="${value.replaceAll('"', '')}"`).join(',')}}`;
}
