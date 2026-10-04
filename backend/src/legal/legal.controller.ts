import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CREDENTIAL_LIMIT } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { Public } from '../common/decorators/public.decorator';
import { parseDeleteAccountForm } from './delete-account.form';
import { HtmlExceptionFilter } from './html-exception.filter';
import { sendHtml } from './html-response';
import { ACCOUNT_DELETE_PATH, PRIVACY_PATH } from './legal.constants';
import { accountDeletedPage, deleteAccountPage, privacyPolicyPage } from './legal.views';

const HTML = 'text/html; charset=utf-8';

/**
 * Public web pages linked from the Google Play listing: the privacy policy and
 * account deletion. Plain HTML outside the /api prefix, hidden from Swagger,
 * and errors are rendered as pages too (see HtmlExceptionFilter).
 */
@ApiExcludeController()
@Public()
@UseFilters(HtmlExceptionFilter)
@Controller()
export class LegalController {
  constructor(private readonly auth: AuthService) {}

  @Get(PRIVACY_PATH)
  @Header('Content-Type', HTML)
  privacyPolicy(): string {
    return privacyPolicyPage();
  }

  @Get(ACCOUNT_DELETE_PATH)
  @Header('Content-Type', HTML)
  deleteAccountForm(): string {
    return deleteAccountPage();
  }

  /**
   * The form above posts here. The body is checked by hand instead of with a
   * DTO, so the global ValidationPipe never answers a browser with JSON.
   */
  @Throttle(CREDENTIAL_LIMIT)
  @Post(ACCOUNT_DELETE_PATH)
  async deleteAccount(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const { email, password, problems } = parseDeleteAccountForm(body);
    if (problems.length > 0) {
      return sendHtml(res, HttpStatus.BAD_REQUEST, deleteAccountPage({ email, problems }));
    }

    try {
      await this.auth.deleteAccountWithCredentials(email, password);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      const page = deleteAccountPage({ email, problems: [{ message: error.message }] });
      return sendHtml(res, HttpStatus.UNAUTHORIZED, page);
    }
    sendHtml(res, HttpStatus.OK, accountDeletedPage(email));
  }
}
