import type { Response } from 'express';

/**
 * Sends a full HTML page. It may show the email the user typed, so it is never
 * cached. `same-origin` referrers, instead of Helmet's `no-referrer`, let older
 * browsers send the Origin header with the page's own forms, which the
 * "Delete with Google" form relies on (see isSameOriginPost).
 */
export function sendHtml(res: Response, status: number, html: string): void {
  res
    .status(status)
    .type('html')
    .set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin' })
    .send(html);
}
