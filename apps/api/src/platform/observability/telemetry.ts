import type { AppConfig } from '@/configs/app-config';

import { ErrorReporter } from './error-reporter';

let started = false;

export async function startTelemetry(config: AppConfig): Promise<void> {
  if (started) {
    return;
  }
  if (config.observability.sentryDsn !== undefined) {
    const sentry = await import('@sentry/node');
    sentry.init({
      dsn: config.observability.sentryDsn,
      environment: config.app.env,
      release: config.observability.release,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        return event;
      },
    });
  }
  if (config.observability.otlpEndpoint !== undefined) {
    const [
      { NodeSDK },
      { OTLPTraceExporter },
      { HttpInstrumentation },
      { PgInstrumentation },
      { IORedisInstrumentation },
    ] = await Promise.all([
      import('@opentelemetry/sdk-node'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/instrumentation-http'),
      import('@opentelemetry/instrumentation-pg'),
      import('@opentelemetry/instrumentation-ioredis'),
    ]);
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: `${config.observability.otlpEndpoint.replace(/\/$/, '')}/v1/traces`,
      }),
      instrumentations: [
        new HttpInstrumentation(),
        new PgInstrumentation(),
        new IORedisInstrumentation(),
      ],
    });
    sdk.start();
  }
  started =
    config.observability.sentryDsn !== undefined || config.observability.otlpEndpoint !== undefined;
}

export class SentryErrorReporter extends ErrorReporter {
  public override capture(error: unknown, requestId: string | undefined): void {
    void import('@sentry/node')
      .then((sentry) => {
        sentry.captureException(error, { tags: requestId === undefined ? {} : { requestId } });
      })
      .catch(() => {
        return;
      });
  }
}
