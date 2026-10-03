import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Connection, ConnectionStates } from 'mongoose';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /** Liveness probe, also handy for checking the app can reach the API. */
  @Public()
  @Get()
  check() {
    const db = this.connection.readyState === ConnectionStates.connected ? 'up' : 'down';
    return { status: 'ok', db, timestamp: new Date().toISOString() };
  }
}
