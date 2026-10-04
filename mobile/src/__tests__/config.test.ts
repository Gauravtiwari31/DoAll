// Each test loads config.ts afresh, with or without a hosted URL in env.ts.
afterEach(() => {
  jest.dontMock('../env');
  jest.resetModules();
});

/** DEFAULT_API_URL comes from the build-time env.ts when CI provides one. */
describe('DEFAULT_API_URL', () => {
  it('falls back to the local backend when no hosted URL is baked in', () => {
    const { DEFAULT_API_URL, LOCAL_API_URL } = require('../config');
    expect(DEFAULT_API_URL).toBe(LOCAL_API_URL);
  });

  it('uses the hosted API from env.ts, normalised', () => {
    jest.doMock('../env', () => ({
      HOSTED_API_URL: 'https://doall-api.onrender.com',
    }));
    const { DEFAULT_API_URL } = require('../config');
    expect(DEFAULT_API_URL).toBe('https://doall-api.onrender.com/api');
  });
});

/** The privacy policy and deletion page live on the build's own server. */
describe('public page URLs', () => {
  it('point at the hosted server in release builds', () => {
    jest.doMock('../env', () => ({
      HOSTED_API_URL: 'https://doall-api-m1yy.onrender.com',
    }));
    const { ACCOUNT_DELETION_URL, PRIVACY_POLICY_URL } = require('../config');
    expect(PRIVACY_POLICY_URL).toBe(
      'https://doall-api-m1yy.onrender.com/privacy',
    );
    expect(ACCOUNT_DELETION_URL).toBe(
      'https://doall-api-m1yy.onrender.com/account/delete',
    );
  });

  it('point at the local backend in dev builds', () => {
    const {
      ACCOUNT_DELETION_URL,
      LOCAL_API_URL,
      PRIVACY_POLICY_URL,
    } = require('../config');
    const local = LOCAL_API_URL.replace(/\/api$/, '');
    expect(PRIVACY_POLICY_URL).toBe(`${local}/privacy`);
    expect(ACCOUNT_DELETION_URL).toBe(`${local}/account/delete`);
  });
});

describe('APP_VERSION', () => {
  it('is the package.json version', () => {
    const { APP_VERSION } = require('../config');
    expect(APP_VERSION).toBe(require('../../package.json').version);
    // Gradle derives versionCode = major * 10000 + minor * 100 + patch.
    expect(APP_VERSION).toMatch(/^\d+\.\d{1,2}\.\d{1,2}$/);
  });
});
