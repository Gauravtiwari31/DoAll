import { siteOrigin } from '../url';

describe('siteOrigin', () => {
  it.each([
    [
      'https://doall-api-m1yy.onrender.com/api',
      'https://doall-api-m1yy.onrender.com',
    ],
    ['http://10.0.2.2:3000/api', 'http://10.0.2.2:3000'],
    ['http://[::1]:3000/api', 'http://[::1]:3000'],
    ['https://example.com/doall/api', 'https://example.com'],
    ['https://doall.example.com', 'https://doall.example.com'],
  ])('%s → %s', (apiUrl, expected) => {
    expect(siteOrigin(apiUrl)).toBe(expected);
  });
});
