import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';

export interface Mail {
  to: string;
  subject: string;
  /** Plain-text body; also the fallback for mail apps that don't show HTML. */
  text: string;
  html: string;
}

/** A provider said no, or couldn't be reached. */
export class MailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailDeliveryError';
  }
}

/** Parses `Name <address>` (or a bare address) from MAIL_FROM. */
export function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1].replace(/^"|"$/g, '').trim();
  return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
}

const TIMEOUT_MS = 10_000;

/**
 * Sends transactional email (verification and password reset links) through
 * an email API over HTTPS: Brevo or Resend, picked with MAIL_PROVIDER. Not
 * SMTP, because free hosts such as Render block outgoing SMTP ports.
 *
 * Without MAIL_PROVIDER, email is off: `enabled` is false and nothing is
 * sent. The rest of the API then doesn't ask for verified addresses.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly settings: AppConfig['mail'];

  constructor(config: ConfigService) {
    this.settings = config.getOrThrow<AppConfig['mail']>('mail');
  }

  get enabled(): boolean {
    return Boolean(this.settings.provider && this.settings.apiKey && this.settings.from);
  }

  /** The email service in use, e.g. "brevo", or null when email is off. */
  get provider(): string | null {
    return this.enabled ? this.settings.provider : null;
  }

  async send(mail: Mail): Promise<void> {
    const { provider, apiKey, from } = this.settings;
    if (!provider || !apiKey || !from) {
      throw new MailDeliveryError('Email is not set up on this server');
    }
    const request: { url: string; headers: Record<string, string>; body: object } =
      provider === 'brevo'
        ? {
            url: 'https://api.brevo.com/v3/smtp/email',
            headers: { 'api-key': apiKey },
            body: {
              sender: parseSender(from),
              to: [{ email: mail.to }],
              subject: mail.subject,
              textContent: mail.text,
              htmlContent: mail.html,
            },
          }
        : {
            url: 'https://api.resend.com/emails',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: { from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html },
          };

    let response: Response;
    try {
      response = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...request.headers },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new MailDeliveryError(`Couldn't reach ${provider}: ${(error as Error).message}`);
    }
    if (!response.ok) {
      // The provider's explanation (bad key, unverified sender...) goes to the log only.
      const detail = await response.text().catch(() => '');
      throw new MailDeliveryError(
        `${provider} answered ${response.status}: ${detail.slice(0, 300)}`,
      );
    }
    this.logger.log(`Sent "${mail.subject}" through ${provider}`);
  }
}
