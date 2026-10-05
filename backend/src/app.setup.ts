import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import {
  ACCOUNT_DELETE_GOOGLE_CALLBACK_PATH,
  ACCOUNT_DELETE_GOOGLE_PATH,
  ACCOUNT_DELETE_PATH,
  PRIVACY_PATH,
  RESET_PASSWORD_PATH,
  VERIFY_EMAIL_PATH,
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
      { path: VERIFY_EMAIL_PATH, method: RequestMethod.GET },
      { path: RESET_PASSWORD_PATH, method: RequestMethod.GET },
      { path: RESET_PASSWORD_PATH, method: RequestMethod.POST },
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
  // Room for a full sync batch (200 tasks), well below anything abusive.
  (app as NestExpressApplication).useBodyParser('json', { limit: '1mb' });
  // The app isn't a browser and the web pages are same-origin, so CORS stays
  // off unless CORS_ORIGINS names a web front end.
  const corsOrigins = app.get(ConfigService).getOrThrow<string[]>('corsOrigins');
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true, // turn payloads into DTO instances (dates, numbers)
    }),
  );
  app.enableShutdownHooks();
}
