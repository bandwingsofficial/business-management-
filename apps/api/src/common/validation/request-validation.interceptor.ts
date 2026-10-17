import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { type Observable } from 'rxjs';
import type { ZodType } from 'zod';

import { ValidationError } from '@/common/errors/application-error';

import { REQUEST_SCHEMA } from './validate-request.decorator';

interface RequestWithBody {
  body: unknown;
}

@Injectable()
export class RequestValidationInterceptor implements NestInterceptor {
  public constructor(private readonly reflector: Reflector) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const schema = this.reflector.getAllAndOverride<ZodType | undefined>(REQUEST_SCHEMA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!schema) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithBody>();
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.map((segment) => String(segment)).join('.'),
          message: issue.message,
        })),
      );
    }

    request.body = parsed.data;
    return next.handle();
  }
}
