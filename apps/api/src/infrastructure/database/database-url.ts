const POSTGRES_URL = /^postgres(ql)?:\/\/\S+$/;

export function requireDatabaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error('DATABASE_URL is required to construct the database adapter');
  }
  if (!POSTGRES_URL.test(value)) {
    throw new Error('DATABASE_URL must be a postgresql connection string');
  }
  return value;
}
