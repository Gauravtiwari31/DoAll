import { ConfigService } from '@nestjs/config';
import { MailDeliveryError, MailService, parseSender } from './mail.service';

const mail = { to: 'ana@example.com', subject: 'Hi', text: 'Hello', html: '<p>Hello</p>' };

const SCRIPT = 'https://script.google.com/macros/s/abc/exec';

const serviceWith = (settings: object) =>
  new MailService(
    new ConfigService({ mail: { provider: null, apiKey: null, from: null, ...settings } }),
  );

describe('parseSender', () => {
  it('reads a name and an address, or a bare address', () => {
    expect(parseSender('DoAll <no-reply@example.com>')).toEqual({
      name: 'DoAll',
      email: 'no-reply@example.com',
    });
    expect(parseSender('"Do All" <a@b.co>')).toEqual({ name: 'Do All', email: 'a@b.co' });
    expect(parseSender('a@b.co')).toEqual({ email: 'a@b.co' });
    expect(parseSender('<a@b.co>')).toEqual({ email: 'a@b.co' });
  });
});

describe('MailService', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  it('is off without a provider', async () => {
    const service = serviceWith({});
    expect(service.enabled).toBe(false);
    await expect(service.send(mail)).rejects.toBeInstanceOf(MailDeliveryError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends through Resend', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = serviceWith({ provider: 'resend', apiKey: 'k', from: 'n@example.com' });
    await service.send(mail);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer k' });
    expect(JSON.parse(init.body as string)).toMatchObject({ from: 'n@example.com', to: [mail.to] });
  });

  it('sends through Gmail via the Apps Script web app', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const service = serviceWith({
      provider: 'gmail',
      apiKey: 'shared-secret',
      from: 'DoAll <me@gmail.com>',
      scriptUrl: SCRIPT,
    });
    await service.send(mail);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SCRIPT);
    expect(JSON.parse(init.body as string)).toEqual({
      secret: 'shared-secret',
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      name: 'DoAll',
    });
  });

  it("reports what the Gmail script said when it didn't send", async () => {
    const service = serviceWith({
      provider: 'gmail',
      apiKey: 'k',
      from: 'DoAll <me@gmail.com>',
      scriptUrl: SCRIPT,
    });
    fetchMock.mockResolvedValueOnce(
      new Response('{"ok":false,"error":"Wrong secret"}', { status: 200 }),
    );
    await expect(service.send(mail)).rejects.toThrow(/Wrong secret/);
    fetchMock.mockResolvedValueOnce(new Response('<html>Sign in</html>', { status: 200 }));
    await expect(service.send(mail)).rejects.toThrow(/gmail script answered 200/);
  });

  it('reports a refusal from the provider', async () => {
    fetchMock.mockResolvedValue(new Response('bad key', { status: 401 }));
    const service = serviceWith({ provider: 'resend', apiKey: 'k', from: 'n@example.com' });
    await expect(service.send(mail)).rejects.toThrow(/resend answered 401: bad key/);
  });
});
