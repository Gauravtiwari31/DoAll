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
  /** Sign in with Google. Both values are null unless set (feature off). */
  google: {
    /**
     * The OAuth client ID of type "Web application". The app asks Google for
     * ID tokens issued to it, and the API only accepts tokens issued to it.
     */
    clientId: string | null;
    /**
     * That client's secret. Only the web account deletion page needs it, to
     * let people who signed up with Google confirm with Google.
     */
    clientSecret: string | null;
  };
  /**
   * The server's own public address, e.g. https://doall-api.onrender.com,
   * used for the links in emails. Render sets RENDER_EXTERNAL_URL itself.
   */
  publicUrl: string | null;
  /**
   * Browser origins allowed to call the API. The app isn't a browser and the
   * web pages are same-origin, so this is empty (CORS off) unless set.
   */
  corsOrigins: string[];
  /**
   * Transactional email (verification and password reset links). Null
   * provider = email off: nothing is sent and sync doesn't wait for a
   * verified address.
   */
  mail: {
    provider: MailProvider | null;
    apiKey: string | null;
    /** Sender, e.g. `DoAll <no-reply@example.com>`. */
    from: string | null;
  };
}

export const MAIL_PROVIDERS = ['brevo', 'resend'] as const;
export type MailProvider = (typeof MAIL_PROVIDERS)[number];

/** Empty strings count as unset, so a blank variable on the host turns a feature off. */
const optional = (value: string | undefined): string | null => value?.trim() || null;

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
  google: {
    clientId: optional(process.env.GOOGLE_CLIENT_ID),
    clientSecret: optional(process.env.GOOGLE_CLIENT_SECRET),
  },
  publicUrl:
    (optional(process.env.PUBLIC_URL) ?? optional(process.env.RENDER_EXTERNAL_URL))?.replace(
      /\/+$/,
      '',
    ) ?? null,
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  mail: {
    provider: optional(process.env.MAIL_PROVIDER)?.toLowerCase() as MailProvider | null,
    apiKey: optional(process.env.MAIL_API_KEY),
    from: optional(process.env.MAIL_FROM),
  },
});
