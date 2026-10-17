export type EnvSource = Readonly<Record<string, string | undefined>>;

export class ConfigurationError extends Error {
  public constructor(public readonly messages: readonly string[]) {
    super(
      `Invalid environment configuration:\n${messages.map((message) => `- ${message}`).join('\n')}`,
    );
    this.name = 'ConfigurationError';
  }
}

export class EnvErrors {
  private readonly messages: string[] = [];

  public add(message: string): void {
    this.messages.push(message);
  }

  public list(): readonly string[] {
    return this.messages;
  }
}

export function readString(source: EnvSource, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function readBoolean(
  source: EnvSource,
  key: string,
  errors: EnvErrors,
  fallback: boolean,
): boolean {
  const value = readString(source, key);
  if (value === undefined) {
    return fallback;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  errors.add(`${key} must be true or false`);
  return fallback;
}

export function readPort(
  source: EnvSource,
  key: string,
  errors: EnvErrors,
  fallback: number | undefined,
): number {
  const value = readString(source, key);
  if (value === undefined) {
    if (fallback === undefined) {
      errors.add(`${key} is required`);
      return 0;
    }
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    errors.add(`${key} must be an integer`);
    return 0;
  }

  const port = Number(value);
  if (port < 1 || port > 65535) {
    errors.add(`${key} must be between 1 and 65535`);
    return 0;
  }

  return port;
}

export function readBoundedInt(
  source: EnvSource,
  key: string,
  errors: EnvErrors,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = readString(source, key);
  if (value === undefined) {
    return fallback;
  }
  if (!/^\d+$/.test(value)) {
    errors.add(`${key} must be an integer`);
    return fallback;
  }
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    errors.add(`${key} must be between ${String(minimum)} and ${String(maximum)}`);
    return fallback;
  }
  return parsed;
}

export function readHttpUrl(source: EnvSource, key: string, errors: EnvErrors): string | undefined {
  const value = readString(source, key);
  if (value === undefined) {
    return undefined;
  }
  if (!/^https?:\/\/\S+$/.test(value)) {
    errors.add(`${key} must be an http(s) URL`);
    return undefined;
  }
  return value;
}
