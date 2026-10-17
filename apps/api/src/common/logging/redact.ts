const SECRET_KEY =
  /secret|password|token|credential|accesskey|api[-_]?key|authorization|cookie|dsn|jwks/i;

function isSecret(key: string): boolean {
  return SECRET_KEY.test(key) || key === 'url';
}

function redactValue(value: unknown, key: string | undefined): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, key));
  }

  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = redactValue(childValue, childKey);
    }
    return output;
  }

  if (typeof value === 'string' && key !== undefined && isSecret(key)) {
    return '[redacted]';
  }

  return value;
}

export function redactSecrets<T>(value: T): T {
  return redactValue(value, undefined) as T;
}
