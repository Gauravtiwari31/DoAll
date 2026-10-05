import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Transactional email, available everywhere (see MailService). */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
