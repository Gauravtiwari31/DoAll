/**
 * E2E tests talk to a real MongoDB (default: local instance, separate database)
 * so queries, indexes and validation behave exactly as in production.
 *   docker compose up -d mongo && npm run test:e2e
 */
process.env.MONGODB_URI = process.env.E2E_MONGODB_URI ?? 'mongodb://localhost:27017/doall_e2e';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-'.padEnd(48, 'a');
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-'.padEnd(48, 'r');
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
// Google sign-in on, with the library's calls to Google stubbed in the tests.
process.env.GOOGLE_CLIENT_ID = 'e2e-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'e2e-client-secret';
