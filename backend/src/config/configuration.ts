/**
 * Typed application configuration.
 *
 * Every value is read from environment variables exactly once, here, so the
 * rest of the codebase depends on `AppConfig` instead of `process.env`.
 */
export interface AppConfig {
  port: number;
  mongoUri: string;
  /**
   * Number of reverse proxies in front of the API (e.g. 1 on Render). Lets
   * Express read the real client IP from X-Forwarded-For, so rate limits are
   * per user instead of shared by everyone behind the proxy. 0 = no proxy.
   */
  trustProxy: number;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
}

export const configuration = (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/doall',
  trustProxy: parseInt(process.env.TRUST_PROXY ?? '0', 10),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
});
