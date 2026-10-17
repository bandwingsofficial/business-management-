export function validateIntegrationDatabaseUrl(url: string | undefined): {
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
};

export function validateIntegrationRedisUrl(url: string | undefined): {
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly host?: string;
  readonly port?: number;
  readonly databaseIndex?: string;
};
