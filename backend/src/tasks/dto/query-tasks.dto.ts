import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_SORTS,
  TASK_STATUSES,
  type TaskCategory,
  type TaskPriority,
  type TaskSort,
  type TaskStatus,
} from '../task.constants';

export class QueryTasksDto {
  /** all | active | completed | overdue */
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus = 'all';

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional()
  @IsIn(TASK_CATEGORIES)
  category?: TaskCategory;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase().replace(/^#/, '') : value,
  )
  @IsString()
  tag?: string;

  /** Case-insensitive match on title or description. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Only tasks scheduled at or after this instant. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  /** Only tasks scheduled before this instant. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @IsIn(TASK_SORTS)
  sort?: TaskSort = 'smart';
}

export class StatsQueryDto {
  /**
   * Client timezone offset in minutes, as returned by JS `Date#getTimezoneOffset()`
   * (e.g. -330 for IST). Used to work out what "today" means for the user.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  tzOffset?: number = 0;
}
