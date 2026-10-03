/** DEFAULT_API_URL comes from the build-time env.ts when CI provides one. */
describe('DEFAULT_API_URL', () => {
  afterEach(() => jest.resetModules());

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
