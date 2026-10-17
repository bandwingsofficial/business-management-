import { randomUUID } from 'node:crypto';

export interface IsolatedRecords {
  readonly organizationA: string;
  readonly organizationB: string;
  readonly userA: string;
  readonly userB: string;
}

export function isolatedRecords(): IsolatedRecords {
  return {
    organizationA: randomUUID(),
    organizationB: randomUUID(),
    userA: `user-${randomUUID()}`,
    userB: `user-${randomUUID()}`,
  };
}

export {
  validateIntegrationDatabaseUrl as assertIsolatedDatabase,
  validateIntegrationRedisUrl as assertIsolatedRedis,
} from './integration-env';
