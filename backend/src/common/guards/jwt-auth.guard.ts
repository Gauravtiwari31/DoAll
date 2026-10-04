import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsersService } from '../../users/users.service';
import { AccessTokenPayload, AuthUser } from '../interfaces/jwt-payload.interface';

/**
 * Global guard: verifies the `Authorization: Bearer <access token>` header on
 * every request unless the route is marked `@Public()`.
 *
 * A dedicated guard keeps the auth path explicit and avoids pulling Passport
 * in just to read one header.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractBearer(request);
    if (!token) throw new UnauthorizedException('Missing access token');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });
    } catch {
      // Expired or tampered. The mobile client reacts to 401 by refreshing.
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // An access token outlives a deleted account until it expires. Refuse it,
    // so nothing new is stored for an account that no longer exists (the
    // client's refresh then fails too, and the app signs out).
    if (!(await this.users.exists(payload.sub))) {
      throw new UnauthorizedException('Account no longer exists');
    }
    request.user = { id: payload.sub, email: payload.email };
    return true;
  }

  private extractBearer(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
