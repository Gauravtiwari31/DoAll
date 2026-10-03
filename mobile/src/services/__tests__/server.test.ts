import { DEFAULT_API_URL } from '../../config';
import { displayHost, normalizeApiUrl, server } from '../server';

describe('normalizeApiUrl', () => {
  it.each([
    ['192.168.1.20:3000', 'http://192.168.1.20:3000/api'],
    ['  http://192.168.1.20:3000/api/  ', 'http://192.168.1.20:3000/api'],
    ['HTTPS://doall.example.com', 'https://doall.example.com/api'],
    ['https://example.com/doall/api', 'https://example.com/doall/api'],
    ['localhost:3000', 'http://localhost:3000/api'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeApiUrl(input)).toBe(expected);
  });

  it.each(['', 'not a url', 'http://', 'ftp://host', 'host:port'])(
    'rejects %p',
    input => {
      expect(normalizeApiUrl(input)).toBeNull();
    },
  );
});

describe('server', () => {
  it('defaults to the emulator address and persists changes', async () => {
    expect(server.getUrl()).toBe(DEFAULT_API_URL);
    await server.save('http://192.168.1.20:3000/api');
    await server.save(DEFAULT_API_URL);
    await server.save('http://10.0.0.5:3000/api');
    expect(await server.restore()).toBe('http://10.0.0.5:3000/api');
    expect(displayHost(server.getUrl())).toBe('10.0.0.5:3000');
  });
});
