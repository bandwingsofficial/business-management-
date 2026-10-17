import type { LogLevel } from '@nestjs/common';

import type { LogLevelName } from './app-config';

const NEST_LEVELS: readonly LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

const THRESHOLD: Record<LogLevelName, LogLevel> = {
  fatal: 'fatal',
  error: 'error',
  warn: 'warn',
  info: 'log',
  debug: 'debug',
  trace: 'verbose',
};

export function nestLoggerLevels(level: LogLevelName): LogLevel[] {
  const threshold = THRESHOLD[level];
  const index = NEST_LEVELS.indexOf(threshold);
  return NEST_LEVELS.slice(0, index + 1);
}
