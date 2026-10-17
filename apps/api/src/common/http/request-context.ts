import { AsyncLocalStorage } from 'node:async_hooks';

import type { AccessContext } from './access-context';

export interface RequestContextState {
  readonly requestId: string;
  readonly traceId?: string;
  readonly spanId?: string;
  access?: AccessContext;
}

const storage = new AsyncLocalStorage<RequestContextState>();

export const requestContext = {
  run<T>(state: RequestContextState, work: () => T): T {
    return storage.run(state, work);
  },
  current(): RequestContextState | undefined {
    return storage.getStore();
  },
  setAccess(access: AccessContext): void {
    const state = storage.getStore();
    if (state) {
      state.access = access;
    }
  },
};
