import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // Interactive API docs at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DoAll API')
    .setDescription('Authentication and task management for the DoAll mobile app')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, swaggerConfig));

  const port = app.get(ConfigService).getOrThrow<number>('port');
  // 0.0.0.0 so the Android emulator (10.0.2.2) and devices on the LAN can reach it.
  await app.listen(port, '0.0.0.0');
  Logger.log(`DoAll API ready on http://localhost:${port}/api (docs: /api/docs)`, 'Bootstrap');
}

void bootstrap();
