import { SetMetadata } from '@nestjs/common';
import type { ZodType } from 'zod';

export const REQUEST_SCHEMA = 'softtech:request-schema';

export function ValidateRequest(schema: ZodType): MethodDecorator {
  return SetMetadata(REQUEST_SCHEMA, schema);
}
