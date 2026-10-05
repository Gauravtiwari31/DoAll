import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import {
  ACCOUNT_DELETE_GOOGLE_CALLBACK_PATH,
  ACCOUNT_DELETE_GOOGLE_PATH,
  ACCOUNT_DELETE_PATH,
  PRIVACY_PATH,
} from './legal/legal.constants';

/**
 * Cross-cutting HTTP setup shared by `main.ts` and the e2e tests, so tests
 * exercise exactly the same pipeline as production.
 */
export function configureApp(app: INestApplication): void {
  // The public web pages (privacy policy, account deletion) live outside /api.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: PRIVACY_PATH, method: RequestMethod.GET },
      { path: ACCOUNT_DELETE_PATH, method: RequestMethod.GET },
      { path: ACCOUNT_DELETE_PATH, method: RequestMethod.POST },
      { path: ACCOUNT_DELETE_GOOGLE_PATH, method: RequestMethod.POST },
      { path: ACCOUNT_DELETE_GOOGLE_CALLBACK_PATH, method: RequestMethod.GET },
    ],
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Helmet's default CSP also asks browsers to upgrade http:// requests
          // to https://. The hosted API is HTTPS anyway, but on a self-hosted
          // server reached over plain HTTP (LAN, emulator) that would send the
          // account deletion form to an https:// address that doesn't exist.
          upgradeInsecureRequests: null,
          // "Delete with Google" posts to this server, which redirects to
          // Google's account chooser. Browsers apply form-action to that
          // redirect too, so Google's sign-in page has to be allowed.
          formAction: ["'self'", 'https://accounts.google.com'],
        },
      },
    }),
  );
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true, // turn payloads into DTO instances (dates, numbers)
    }),
  );
  app.enableShutdownHooks();
}
