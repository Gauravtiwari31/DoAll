import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { AuthService } from './auth.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

/** Stricter rate limit for credential endpoints to slow down brute forcing. */
export const CREDENTIAL_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Create an account and receive a token pair (user is signed in immediately). */
  @Public()
  @Throttle(CREDENTIAL_LIMIT)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  /** Exchange email + password for a token pair. */
  @Public()
  @Throttle(CREDENTIAL_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /**
   * Sign in, or sign up the first time, with a Google ID token from the app.
   * If an email/password account already uses the address, the answer is 409
   * with `code: GOOGLE_LINK_PASSWORD_REQUIRED` until that account's password
   * is sent along, which connects Google to it.
   */
  @Public()
  @Throttle(CREDENTIAL_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post('google')
  google(@Body() dto: GoogleSignInDto) {
    return this.auth.signInWithGoogle(dto);
  }

  /** Rotate a refresh token: the old one is invalidated, a new pair is returned. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /** Revoke the session tied to this refresh token. */
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  /** The currently authenticated user's profile. */
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /**
   * Permanently delete the account, all of its tasks and every session. Needs
   * the password, or a fresh Google ID token for an account without one.
   */
  @ApiBearerAuth()
  @Throttle(CREDENTIAL_LIMIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('me')
  async deleteMe(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto): Promise<void> {
    await this.auth.deleteAccount(user.id, dto);
  }
}
