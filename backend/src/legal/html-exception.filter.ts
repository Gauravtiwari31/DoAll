import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { sendHtml } from './html-response';
import { ACCOUNT_DELETE_PATH } from './legal.constants';
import { errorPage } from './legal.views';

const DELETE_URL = `/${ACCOUNT_DELETE_PATH}`;

/**
 * Bound to the public pages so a browser is never shown the API's JSON errors:
 * the rate limiter's 429 on the deletion form, other HTTP errors, and
 * unexpected failures (logged, then shown as a generic 500 page).
 */
@Catch()
export class HtmlExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HtmlExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(error.message, error.stack);
    }
    if (res.headersSent) return;
    // "Try again" leads to a page, not to a form's target or Google's callback.
    const retryPath = req.path.startsWith(DELETE_URL) ? DELETE_URL : req.path;
    sendHtml(res, status, errorPage(status, retryPath));
  }
}
