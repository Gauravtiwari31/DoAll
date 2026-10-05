import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleIdentityService } from './google-identity.service';

@Module({
  // Secrets/TTLs are passed per call (access vs refresh use different keys).
  imports: [UsersModule, TasksModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, GoogleIdentityService],
  // AuthService and Google sign-in are shared with the public account deletion page.
  exports: [JwtModule, AuthService, GoogleIdentityService],
})
export class AuthModule {}
