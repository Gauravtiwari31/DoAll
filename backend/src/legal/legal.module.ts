import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LegalController } from './legal.controller';

/** Privacy policy and account deletion pages (public HTML, outside /api). */
@Module({
  imports: [AuthModule],
  controllers: [LegalController],
})
export class LegalModule {}
