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
import { errorPage } from './legal.views';

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
    sendHtml(res, status, errorPage(status, req.path));
  }
}
