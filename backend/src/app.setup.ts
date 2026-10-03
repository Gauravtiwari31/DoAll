import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

/**
 * Cross-cutting HTTP setup shared by `main.ts` and the e2e tests, so tests
 * exercise exactly the same pipeline as production.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(helmet());
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
