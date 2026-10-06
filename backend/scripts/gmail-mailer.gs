/**
 * DoAll mailer: sends DoAll's emails (address confirmation, password reset)
 * from your Gmail account. DoAll's server posts each email here.
 *
 * Setup (docs/operations.md, "Email with your Gmail"):
 *  1. script.google.com → New project, paste this file, save.
 *  2. Project Settings → Script Properties → add SECRET = a long random value
 *     (the same value goes into Render's MAIL_API_KEY).
 *  3. Deploy → New deployment → Web app; Execute as: Me; Who has access:
 *     Anyone. Authorize, and copy the web app URL into MAIL_SCRIPT_URL.
 *
 * "Anyone" only means anyone can call the URL; without the secret nothing is
 * sent. Gmail allows about 100 recipients a day on a free account.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || data.secret !== secret) {
      return reply({ ok: false, error: 'Wrong secret' });
    }
    if (!data.to || !data.subject) {
      return reply({ ok: false, error: 'Missing to or subject' });
    }
    MailApp.sendEmail({
      to: data.to,
      subject: data.subject,
      body: data.text || '',
      htmlBody: data.html || undefined,
      name: data.name || 'DoAll',
    });
    return reply({ ok: true, remainingToday: MailApp.getRemainingDailyQuota() });
  } catch (error) {
    return reply({ ok: false, error: String(error) });
  }
}

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
