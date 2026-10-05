import { ConfigService } from '@nestjs/config';
import { MailDeliveryError, MailService, parseSender } from './mail.service';

const mail = { to: 'ana@example.com', subject: 'Hi', text: 'Hello', html: '<p>Hello</p>' };

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

  it('sends through Brevo', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));
    const service = serviceWith({ provider: 'brevo', apiKey: 'k', from: 'DoAll <n@example.com>' });
    await service.send(mail);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers).toMatchObject({ 'api-key': 'k' });
    expect(JSON.parse(init.body as string)).toMatchObject({
      sender: { name: 'DoAll', email: 'n@example.com' },
      to: [{ email: 'ana@example.com' }],
      subject: 'Hi',
    });
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

  it('reports a refusal from the provider', async () => {
    fetchMock.mockResolvedValue(new Response('bad key', { status: 401 }));
    const service = serviceWith({ provider: 'resend', apiKey: 'k', from: 'n@example.com' });
    await expect(service.send(mail)).rejects.toThrow(/resend answered 401: bad key/);
  });
});
