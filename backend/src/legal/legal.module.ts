import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountLinksController } from './account-links.controller';
import { LegalController } from './legal.controller';

/**
 * Public HTML pages outside /api: the privacy policy, account deletion, and
 * the pages the links in emails open.
 */
@Module({
  imports: [AuthModule],
  controllers: [LegalController, AccountLinksController],
})
export class LegalModule {}
