import { escapeHtml } from '../common/utils/escape-html';
import { APP_NAME } from '../legal/legal.constants';
import type { Mail } from '../mail/mail.service';

/*
 * The two emails DoAll sends. Each has a plain-text and a simple HTML body:
 * one link, no images, no tracking.
 */

const html = (heading: string, intro: string, link: string, button: string, footer: string) =>
  `<!doctype html><html><body style="margin:0;padding:24px;background:#f2ede4;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#121212">
<div style="max-width:480px;margin:0 auto;padding:24px;background:#fffcf6;border:2px solid #121212;border-radius:14px">
<p style="margin:0 0 4px;font-size:22px;font-weight:800">Do<em style="font-family:Georgia,serif;font-weight:400">All</em></p>
<h1 style="margin:16px 0 8px;font-size:22px">${heading}</h1>
<p style="margin:0 0 20px;line-height:1.5">${intro}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;font-weight:800;color:#121212;background:#ff5a1f;border:2px solid #121212;border-radius:12px;text-decoration:none">${button}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#5e594f;line-height:1.5">Or open this address: <span style="word-break:break-all">${escapeHtml(link)}</span></p>
<p style="margin:0;font-size:13px;color:#5e594f;line-height:1.5">${footer}</p>
</div></body></html>`;

export function verificationEmail(to: string, name: string, link: string): Mail {
  const footer = `The link works for 3 days. If you didn't sign up for ${APP_NAME}, ignore this email.`;
  return {
    to,
    subject: `Confirm your email for ${APP_NAME}`,
    text: `Hi ${name},\n\nConfirm your email address to back up your ${APP_NAME} tasks and sync them between your devices:\n\n${link}\n\n${footer}\n`,
    html: html(
      'Confirm your email',
      `Hi ${escapeHtml(name)}, confirm your email address to back up your ${APP_NAME} tasks and sync them between your devices.`,
      link,
      'Confirm my email',
      footer,
    ),
  };
}

export function passwordResetEmail(to: string, name: string, link: string): Mail {
  const footer = `The link works for 1 hour, once. If you didn't ask to reset your password, ignore this email: your password stays the same.`;
  return {
    to,
    subject: `Reset your ${APP_NAME} password`,
    text: `Hi ${name},\n\nSomeone (hopefully you) asked to reset the password of your ${APP_NAME} account. Choose a new password here:\n\n${link}\n\n${footer}\n`,
    html: html(
      'Reset your password',
      `Hi ${escapeHtml(name)}, someone (hopefully you) asked to reset the password of your ${APP_NAME} account. Choose a new one with the button below.`,
      link,
      'Choose a new password',
      footer,
    ),
  };
}
