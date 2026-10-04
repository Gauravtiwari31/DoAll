import type { Response } from 'express';

/** Sends a full HTML page. It may show the email the user typed, so it is never cached. */
export function sendHtml(res: Response, status: number, html: string): void {
  res.status(status).type('html').set('Cache-Control', 'no-store').send(html);
}
