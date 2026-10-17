import type { LoggerService } from '@nestjs/common';
import { type LogLevel } from '@nestjs/common';

import { requestContext } from '@/common/http/request-context';
import type { LogLevelName } from '@/configs/app-config';

import { redactSecrets } from './redact';

export interface LogRecord {
  readonly timestamp: string;
  readonly severity: string;
  readonly service: string;
  readonly environment: string;
  readonly message: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly fields?: Readonly<Record<string, unknown>>;
}

export interface LogSink {
  write(line: string): void;
}

export class StructuredLogger implements LoggerService {
  public constructor(
    private readonly settings: {
      readonly env: string;
      readonly level: LogLevelName;
      readonly serviceName: string;
      readonly json: boolean;
    },
    private readonly sink: LogSink = {
      write(line: string): void {
        process.stdout.write(`${line}\n`);
      },
    },
  ) {}

  public log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  public error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  public warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  public debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  public verbose(message: unknown, context?: string): void {
    this.write('trace', message, context);
  }

  public fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  public setLogLevels(_levels: LogLevel[]): void {
    return;
  }

  public record(
    severity: LogLevelName,
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ): void {
    if (!enabled(this.settings.level, severity)) {
      return;
    }
    const current = requestContext.current();
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      severity,
      service: this.settings.serviceName,
      environment: this.settings.env,
      message,
      ...(current?.requestId === undefined ? {} : { requestId: current.requestId }),
      ...(current?.traceId === undefined ? {} : { traceId: current.traceId }),
      ...(current?.spanId === undefined ? {} : { spanId: current.spanId }),
      ...(fields === undefined ? {} : { fields: redactSecrets(fields) as Record<string, unknown> }),
    };
    this.sink.write(this.settings.json ? JSON.stringify(record) : formatText(record));
  }

  private write(severity: LogLevelName, message: unknown, context?: string, trace?: string): void {
    const text = typeof message === 'string' ? message : 'log';
    this.record(severity, context === undefined ? text : `${context} ${text}`, {
      ...(trace === undefined ? {} : { trace: redactSecrets(trace) }),
    });
  }
}

const ORDER: readonly LogLevelName[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

function enabled(configured: LogLevelName, actual: LogLevelName): boolean {
  return ORDER.indexOf(actual) <= ORDER.indexOf(configured);
}

function formatText(record: LogRecord): string {
  const request = record.requestId === undefined ? '' : ` requestId=${record.requestId}`;
  const trace = record.traceId === undefined ? '' : ` traceId=${record.traceId}`;
  return `${record.timestamp} ${record.severity} ${record.service}${request}${trace} ${record.message}`;
}
