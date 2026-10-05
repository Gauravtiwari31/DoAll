import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CREDENTIAL_LIMIT } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import {
  GoogleIdentity,
  GoogleIdentityService,
  InvalidGoogleTokenError,
} from '../auth/google-identity.service';
import { Public } from '../common/decorators/public.decorator';
import { MailService } from '../mail/mail.service';
import { escapeHtml } from '../common/utils/escape-html';
import { CONFIRM_PROBLEM, isConfirmed, parseDeleteAccountForm } from './delete-account.form';
import {
  GOOGLE_FLOW_COOKIE,
  googleCallbackUrl,
  googleFlowCookie,
  isSameOriginPost,
  newGoogleFlow,
  readGoogleFlow,
  sameSecret,
  serializeGoogleFlow,
} from './google-deletion';
import { HtmlExceptionFilter } from './html-exception.filter';
import { sendHtml } from './html-response';
import {
  ACCOUNT_DELETE_GOOGLE_CALLBACK_PATH,
  ACCOUNT_DELETE_GOOGLE_PATH,
  ACCOUNT_DELETE_PATH,
  APP_NAME,
  PRIVACY_PATH,
} from './legal.constants';
import {
  accountDeletedPage,
  DeleteAccountPageState,
  deleteAccountPage,
  googleDeletionProblemPage,
  privacyPolicyPage,
} from './legal.views';

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
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleIdentityService,
    private readonly mail: MailService,
  ) {}

  @Get(PRIVACY_PATH)
  @Header('Content-Type', HTML)
  privacyPolicy(): string {
    return privacyPolicyPage({ emailProvider: this.mail.enabled ? this.mail.provider : null });
  }

  @Get(ACCOUNT_DELETE_PATH)
  deleteAccountForm(@Res() res: Response): void {
    sendHtml(res, HttpStatus.OK, this.deletePage());
  }

  /**
   * The email and password form posts here. The body is checked by hand
   * instead of with a DTO, so the global ValidationPipe never answers a
   * browser with JSON.
   */
  @Throttle(CREDENTIAL_LIMIT)
  @Post(ACCOUNT_DELETE_PATH)
  async deleteAccount(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const { email, password, problems } = parseDeleteAccountForm(body);
    if (problems.length > 0) {
      return sendHtml(res, HttpStatus.BAD_REQUEST, this.deletePage({ email, problems }));
    }

    try {
      await this.auth.deleteAccountWithCredentials(email, password);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      const page = this.deletePage({ email, problems: [{ message: error.message }] });
      return sendHtml(res, HttpStatus.UNAUTHORIZED, page);
    }
    sendHtml(res, HttpStatus.OK, accountDeletedPage(email));
  }

  /**
   * "Signed up with Google?" posts here: once the box is ticked, the browser
   * goes to Google's account chooser (see google-deletion.ts for the flow).
   */
  @Throttle(CREDENTIAL_LIMIT)
  @Post(ACCOUNT_DELETE_GOOGLE_PATH)
  startGoogleDeletion(@Body() body: unknown, @Req() req: Request, @Res() res: Response): void {
    if (!this.google.webEnabled) throw new NotFoundException();
    // Otherwise any website could send its visitors' browsers through here,
    // and a click in Google's account chooser would delete their account.
    if (!isSameOriginPost(req)) throw new ForbiddenException();
    if (!isConfirmed(body)) {
      const page = this.deletePage({ googleProblem: CONFIRM_PROBLEM });
      return sendHtml(res, HttpStatus.BAD_REQUEST, page);
    }

    const flow = newGoogleFlow();
    res.cookie(GOOGLE_FLOW_COOKIE, serializeGoogleFlow(flow), googleFlowCookie(req));
    const url = this.google.authorizationUrl({ redirectUri: googleCallbackUrl(req), ...flow });
    res.redirect(HttpStatus.SEE_OTHER, url);
  }

  /** Google sends the browser back here, with a one-time code or an error. */
  @Throttle(CREDENTIAL_LIMIT)
  @Get(ACCOUNT_DELETE_GOOGLE_CALLBACK_PATH)
  async finishGoogleDeletion(
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.google.webEnabled) throw new NotFoundException();
    const flow = readGoogleFlow(req);
    // One attempt per cookie, whatever happens next. (clearCookie ignores maxAge.)
    res.clearCookie(GOOGLE_FLOW_COOKIE, googleFlowCookie(req));

    if (query.error !== undefined) {
      const page = googleDeletionProblemPage(
        'Nothing was deleted',
        'You left Google without choosing an account, so your account is still there.',
      );
      return sendHtml(res, HttpStatus.OK, page);
    }
    if (!flow || !sameSecret(flow.state, query.state) || typeof query.code !== 'string') {
      const page = googleDeletionProblemPage(
        'Please start again',
        'That sign-in had expired or was already used, so nothing was deleted. Go back and choose your Google account again.',
      );
      return sendHtml(res, HttpStatus.BAD_REQUEST, page);
    }

    let identity: GoogleIdentity;
    try {
      identity = await this.google.exchangeCode(query.code, googleCallbackUrl(req), flow.nonce);
    } catch (error) {
      if (!(error instanceof InvalidGoogleTokenError)) throw error;
      const page = googleDeletionProblemPage(
        "Google couldn't confirm your account",
        'Nothing was deleted. Please go back and try again.',
      );
      return sendHtml(res, HttpStatus.UNAUTHORIZED, page);
    }

    const deletedEmail = await this.auth.deleteAccountWithGoogle(identity);
    if (!deletedEmail) {
      const page = googleDeletionProblemPage(
        'No account to delete',
        `No ${APP_NAME} account is connected to the Google account <strong>${escapeHtml(identity.email)}</strong> or registered with that email address, so nothing was deleted. If you signed up with a different address, use the email and password form instead.`,
      );
      return sendHtml(res, HttpStatus.NOT_FOUND, page);
    }
    sendHtml(res, HttpStatus.OK, accountDeletedPage(deletedEmail));
  }

  /** The deletion page, with "Delete with Google" when the server can offer it. */
  private deletePage(state: DeleteAccountPageState = {}): string {
    return deleteAccountPage({ ...state, googleEnabled: this.google.webEnabled });
  }
}
