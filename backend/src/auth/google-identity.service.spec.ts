import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  gaxios,
  GetTokenOptions,
  LoginTicket,
  OAuth2Client,
  VerifyIdTokenOptions,
} from 'google-auth-library';
import { GoogleIdentityService, InvalidGoogleTokenError } from './google-identity.service';

const CLIENT_ID = '1234-abc.apps.googleusercontent.com';

const serviceWith = (google: { clientId?: string | null; clientSecret?: string | null }) =>
  new GoogleIdentityService({
    get: (key: string) =>
      ({
        'google.clientId': google.clientId ?? null,
        'google.clientSecret': google.clientSecret ?? null,
      })[key],
  } as unknown as ConfigService);

const ticket = (payload: Record<string, unknown>) =>
  new LoginTicket('envelope', {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    iat: 0,
    exp: 0,
    sub: 'google-sub',
    email: 'Ada@Example.com',
    email_verified: true,
    name: 'Ada Lovelace',
    ...payload,
  });

/** The library's methods also have a callback form; the tests stub the promise form. */
const spyOnVerify = () =>
  jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as unknown as jest.SpyInstance<
    Promise<LoginTicket>,
    [VerifyIdTokenOptions]
  >;
const spyOnGetToken = () =>
  jest.spyOn(OAuth2Client.prototype, 'getToken') as unknown as jest.SpyInstance<
    Promise<{ tokens: { id_token?: string } }>,
    [GetTokenOptions]
  >;

describe('GoogleIdentityService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is off without a client ID, and the web flow also needs the secret', () => {
    expect(serviceWith({}).enabled).toBe(false);
    expect(serviceWith({ clientId: CLIENT_ID }).enabled).toBe(true);
    expect(serviceWith({ clientId: CLIENT_ID }).webEnabled).toBe(false);
    expect(serviceWith({ clientId: CLIENT_ID, clientSecret: 'secret' }).webEnabled).toBe(true);
  });

  it('builds the account chooser URL for the browser flow', () => {
    const url = new URL(
      serviceWith({ clientId: CLIENT_ID, clientSecret: 'secret' }).authorizationUrl({
        redirectUri: 'https://doall.example/account/delete/google/callback',
        state: 'the-state',
        nonce: 'the-nonce',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: CLIENT_ID,
      redirect_uri: 'https://doall.example/account/delete/google/callback',
      response_type: 'code',
      scope: 'openid email',
      state: 'the-state',
      nonce: 'the-nonce',
      prompt: 'select_account',
    });
  });

  it('verifies ID tokens for this client ID and reads the identity', async () => {
    const verify = spyOnVerify().mockResolvedValue(ticket({}));

    await expect(serviceWith({ clientId: CLIENT_ID }).verifyIdToken('id-token')).resolves.toEqual({
      id: 'google-sub',
      email: 'ada@example.com',
      emailVerified: true,
      name: 'Ada Lovelace',
    });
    expect(verify).toHaveBeenCalledWith({ idToken: 'id-token', audience: CLIENT_ID });
  });

  it('treats an unverified or missing email flag as unverified', async () => {
    spyOnVerify().mockResolvedValue(ticket({ email_verified: undefined }));
    const identity = await serviceWith({ clientId: CLIENT_ID }).verifyIdToken('id-token');
    expect(identity.emailVerified).toBe(false);
  });

  it('rejects tokens the library refuses, and a nonce from another request', async () => {
    const service = serviceWith({ clientId: CLIENT_ID });
    const verify = spyOnVerify();

    verify.mockRejectedValue(new Error('Wrong recipient, payload audience != requiredAudience'));
    await expect(service.verifyIdToken('id-token')).rejects.toBeInstanceOf(InvalidGoogleTokenError);

    verify.mockResolvedValue(ticket({ nonce: 'other' }));
    await expect(service.verifyIdToken('id-token', 'mine')).rejects.toBeInstanceOf(
      InvalidGoogleTokenError,
    );
  });

  it("reports not reaching Google as the server's problem (503)", async () => {
    spyOnVerify().mockRejectedValue(
      new gaxios.GaxiosError('getaddrinfo ENOTFOUND www.googleapis.com', {
        url: new URL('https://www.googleapis.com/oauth2/v1/certs'),
      } as never),
    );
    await expect(
      serviceWith({ clientId: CLIENT_ID }).verifyIdToken('id-token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('trades the code for an ID token and checks it answers this request', async () => {
    const service = serviceWith({ clientId: CLIENT_ID, clientSecret: 'secret' });
    const getToken = spyOnGetToken().mockResolvedValue({ tokens: { id_token: 'id-token' } });
    const verify = spyOnVerify().mockResolvedValue(ticket({ nonce: 'the-nonce' }));

    const identity = await service.exchangeCode('the-code', 'https://x/cb', 'the-nonce');

    expect(identity.id).toBe('google-sub');
    expect(getToken).toHaveBeenCalledWith({ code: 'the-code', redirect_uri: 'https://x/cb' });
    expect(verify).toHaveBeenCalledWith({ idToken: 'id-token', audience: CLIENT_ID });
  });
});
