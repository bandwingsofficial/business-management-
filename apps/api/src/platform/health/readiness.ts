export type ProbeStatus = 'up' | 'down' | 'not_configured';

export interface DependencyProbe {
  readonly name: 'database' | 'redis';
  check(timeoutMs: number): Promise<ProbeStatus>;
}

export interface ReadinessReport {
  readonly status: 'ready' | 'not_ready';
  readonly checks: Readonly<Record<string, ProbeStatus>>;
}

export class ReadinessService {
  public constructor(private readonly probes: readonly DependencyProbe[]) {}

  public async check(timeoutMs: number): Promise<ReadinessReport> {
    const checks: Record<string, ProbeStatus> = {};
    for (const probe of this.probes) {
      checks[probe.name] = await probe.check(timeoutMs);
    }
    const notReady = Object.values(checks).some((status) => status === 'down');
    return { status: notReady ? 'not_ready' : 'ready', checks };
  }
}

export class StaticProbe implements DependencyProbe {
  public constructor(
    public readonly name: 'database' | 'redis',
    private readonly status: ProbeStatus,
  ) {}

  public async check(): Promise<ProbeStatus> {
    return this.status;
  }
}
