import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.getOrThrow<string>('mongoUri') }),
    }),
    // Generous global limit; credential endpoints tighten it with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    UsersModule,
    AuthModule,
    TasksModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate-limit first, then authenticate.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
