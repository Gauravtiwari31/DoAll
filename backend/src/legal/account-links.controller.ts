import { Body, Controller, Get, HttpStatus, Post, Query, Res, UseFilters } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CREDENTIAL_LIMIT } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { passwordProblem } from '../auth/password-rules';
import { Public } from '../common/decorators/public.decorator';
import { HtmlExceptionFilter } from './html-exception.filter';
import { sendHtml } from './html-response';
import { RESET_PASSWORD_PATH, VERIFY_EMAIL_PATH } from './legal.constants';
import { emailVerifiedPage, passwordResetDonePage, resetPasswordPage } from './legal.views';

/** Anything but a plain string (`token[]=x` parses to an array) counts as missing. */
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * The pages behind the links in DoAll's emails: confirming an address and
 * choosing a new password. Public HTML like the other pages in this module.
 */
@ApiExcludeController()
@Public()
@UseFilters(HtmlExceptionFilter)
@Controller()
export class AccountLinksController {
  constructor(private readonly auth: AuthService) {}

  @Get(VERIFY_EMAIL_PATH)
  async verifyEmail(@Query('token') token: unknown, @Res() res: Response): Promise<void> {
    const email = text(token) ? await this.auth.verifyEmail(text(token)) : null;
    sendHtml(res, email ? HttpStatus.OK : HttpStatus.NOT_FOUND, emailVerifiedPage(email));
  }

  @Get(RESET_PASSWORD_PATH)
  async resetPasswordForm(@Query('token') token: unknown, @Res() res: Response): Promise<void> {
    const value = text(token);
    if (!value || !(await this.auth.isPasswordResetTokenValid(value))) {
      return sendHtml(res, HttpStatus.NOT_FOUND, passwordResetDonePage(null));
    }
    sendHtml(res, HttpStatus.OK, resetPasswordPage(value));
  }

  /** Checked by hand, like the deletion form, so mistakes come back as the page. */
  @Throttle(CREDENTIAL_LIMIT)
  @Post(RESET_PASSWORD_PATH)
  async resetPassword(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const fields =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const token = text(fields.token);
    const password = text(fields.password);
    if (!token) return sendHtml(res, HttpStatus.NOT_FOUND, passwordResetDonePage(null));

    const problem =
      passwordProblem(password) ??
      (password === text(fields.confirmPassword) ? null : "The two passwords don't match");
    if (problem) {
      return sendHtml(res, HttpStatus.BAD_REQUEST, resetPasswordPage(token, problem));
    }

    const email = await this.auth.resetPassword(token, password);
    sendHtml(res, email ? HttpStatus.OK : HttpStatus.NOT_FOUND, passwordResetDonePage(email));
  }
}
