import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { SyncRequestDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /**
   * Push the device's changed tasks and pull everything changed on the server
   * since `cursor` (see SyncService). 403 with `code: EMAIL_NOT_VERIFIED`
   * until the account's email address is confirmed, when the server sends
   * confirmation emails.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  run(@CurrentUser() user: AuthUser, @Body() dto: SyncRequestDto) {
    return this.sync.sync(user.id, dto);
  }
}
