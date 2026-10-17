export type NodeEnv = 'development' | 'test' | 'production';

export type LogLevelName = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface AppSettings {
  readonly name: string;
  readonly env: NodeEnv;
}

export interface HttpSettings {
  readonly host: string;
  readonly port: number;
  readonly prefix: string;
  readonly defaultVersion: string;
  readonly corsOrigins: readonly string[];
  readonly bodyLimitBytes: number;
  readonly timeoutMs: number;
  readonly trustProxy: boolean;
  readonly rateLimitWindowSeconds: number;
  readonly rateLimitMax: number;
  readonly authRateLimitMax: number;
}

export interface DatabaseSettings {
  readonly url?: string;
  readonly poolMax: number;
  readonly connectionTimeoutMs: number;
  readonly idleTimeoutMs: number;
  readonly queryTimeoutMs: number;
}

export interface RedisSettings {
  readonly url?: string;
  readonly connectTimeoutMs: number;
  readonly commandTimeoutMs: number;
  readonly maxRetries: number;
}

export interface AuthSettings {
  readonly issuer?: string;
  readonly audience?: string;
  readonly jwksUri?: string;
}

export interface SecuritySettings {
  readonly helmetEnabled: boolean;
}

export interface LoggingSettings {
  readonly level: LogLevelName;
}

export interface StorageSettings {
  readonly driver: 'none' | 's3';
  readonly bucket?: string;
  readonly region?: string;
  readonly endpoint?: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
}

export interface EmailSettings {
  readonly driver: 'none' | 'smtp';
  readonly from?: string;
  readonly host?: string;
  readonly port?: number;
  readonly password?: string;
}

export interface JobsSettings {
  readonly driver: 'none' | 'redis';
}

export interface OpenApiSettings {
  readonly enabled: boolean;
  readonly title: string;
  readonly description: string;
}

export interface ObservabilitySettings {
  readonly otlpEndpoint?: string;
  readonly sentryDsn?: string;
  readonly release?: string;
  readonly metricsToken?: string;
}

export interface AppConfig {
  readonly app: AppSettings;
  readonly http: HttpSettings;
  readonly database: DatabaseSettings;
  readonly redis: RedisSettings;
  readonly auth: AuthSettings;
  readonly security: SecuritySettings;
  readonly logging: LoggingSettings;
  readonly storage: StorageSettings;
  readonly email: EmailSettings;
  readonly jobs: JobsSettings;
  readonly openapi: OpenApiSettings;
  readonly observability: ObservabilitySettings;
}
