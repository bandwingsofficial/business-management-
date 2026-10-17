export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export function normalizePageRequest(
  input: Partial<PageRequest> | undefined,
  options?: { readonly pageSize?: number; readonly maxPageSize?: number },
): PageRequest {
  const defaultPageSize = options?.pageSize ?? 20;
  const maxPageSize = options?.maxPageSize ?? 100;
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? defaultPageSize;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error('page must be an integer greater than or equal to 1');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
    throw new Error(`pageSize must be an integer from 1 to ${String(maxPageSize)}`);
  }

  return { page, pageSize };
}
