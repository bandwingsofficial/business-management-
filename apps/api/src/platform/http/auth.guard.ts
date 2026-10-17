import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AuthorizationError } from '@/common/errors/application-error';
import { requestContext } from '@/common/http/request-context';

import { AccessResolver } from '../access/access-resolver';
import { hasPermission, type Permission } from '../access/permissions';

export const IS_PUBLIC = 'softtech:public';
export const REQUIRED_PERMISSION = 'softtech:permission';

export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC, true);

export const RequirePermission = (permission: Permission): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_PERMISSION, permission);

@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessResolver) private readonly access: AccessResolver,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
    const organizationId = request.header('x-organization-id');
    const access = await this.access.authenticate({
      token,
      organizationId,
      rateLimitKey: `auth:${clientAddress(request)}`,
    });
    requestContext.setAccess(access);

    const required = this.reflector.getAllAndOverride<Permission | undefined>(REQUIRED_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required !== undefined && !hasPermission(access.permissions, required)) {
      throw new AuthorizationError('PERMISSION_DENIED');
    }
    return true;
  }
}

function clientAddress(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}
