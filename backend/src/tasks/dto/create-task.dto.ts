import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import {
  MAX_TAGS,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  type TaskCategory,
  type TaskPriority,
} from '../task.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Lowercases, trims and de-duplicates tags; drops empty ones. */
const normalizeTags = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.trim().toLowerCase().replace(/^#/, ''))
            .filter(Boolean),
        ),
      ]
    : value;

export class CreateTaskDto {
  @Transform(trim)
  @IsString()
  @Length(1, 120, { message: 'Title must be between 1 and 120 characters' })
  title: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'Description must be at most 1000 characters' })
  description?: string;

  /** ISO 8601 date-time the task is planned for. Defaults to now. */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'scheduledAt must be a valid date' })
  scheduledAt?: Date;

  /** ISO 8601 due date-time, or null for no deadline. */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'deadline must be a valid date' })
  deadline?: Date | null;

  @IsOptional()
  @IsIn(TASK_PRIORITIES, { message: `priority must be one of: ${TASK_PRIORITIES.join(', ')}` })
  priority?: TaskPriority;

  @IsOptional()
  @IsIn(TASK_CATEGORIES, { message: `category must be one of: ${TASK_CATEGORIES.join(', ')}` })
  category?: TaskCategory;

  @IsOptional()
  @Transform(normalizeTags)
  @IsArray()
  @ArrayMaxSize(MAX_TAGS, { message: `A task can have at most ${MAX_TAGS} tags` })
  @IsString({ each: true })
  @Length(1, 20, { each: true, message: 'Each tag must be between 1 and 20 characters' })
  tags?: string[];
}
