export type IsolationLevel = 'ReadCommitted' | 'Serializable';

export interface UnitOfWorkOptions {
  readonly isolationLevel?: IsolationLevel;
  readonly timeoutMs?: number;
}

export interface UnitOfWork {
  run<T>(work: () => Promise<T>, options?: UnitOfWorkOptions): Promise<T>;
}

export const DEFAULT_ISOLATION_LEVEL: IsolationLevel = 'ReadCommitted';

export function resolveIsolation(options?: UnitOfWorkOptions): IsolationLevel {
  return options?.isolationLevel ?? DEFAULT_ISOLATION_LEVEL;
}
