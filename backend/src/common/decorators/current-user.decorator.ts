import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../interfaces/jwt-payload.interface';

/**
 * Injects the authenticated user (set by `JwtAuthGuard`) into a handler:
 *
 *   @Get() list(@CurrentUser() user: AuthUser) { ... }
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
  return request.user;
});
