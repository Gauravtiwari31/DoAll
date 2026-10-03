import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto, StatsQueryDto } from './dto/query-tasks.dto';
import { SetTaskStatusDto, UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

/** All routes require a valid access token and only ever touch the caller's tasks. */
@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  /** List tasks with optional filtering, search and sorting. */
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryTasksDto) {
    return this.tasks.findAll(user.id, query);
  }

  /** Counters for the dashboard (overdue, due today, completion rate, ...). */
  @Get('stats')
  stats(@CurrentUser() user: AuthUser, @Query() query: StatsQueryDto) {
    return this.tasks.stats(user.id, query.tzOffset);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.tasks.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user.id, id, dto);
  }

  /** Mark a task as completed / not completed. */
  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetTaskStatusDto,
  ) {
    return this.tasks.setCompleted(user.id, id, dto.completed);
  }

  /** Bulk-delete every completed task. Declared before `:id` so it is matched first. */
  @Delete('completed')
  removeCompleted(@CurrentUser() user: AuthUser) {
    return this.tasks.removeCompleted(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    await this.tasks.remove(user.id, id);
  }
}
