import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MAX_REMINDER_OFFSET_MINUTES,
  MAX_TAGS,
  RECURRENCE_FREQUENCIES,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  type RecurrenceFrequency,
  type TaskCategory,
  type TaskPriority,
} from '../../tasks/task.constants';

/** Most changes one sync request may carry; the app sends more in several requests. */
export const MAX_SYNC_CHANGES = 200;

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

export class RecurrenceDto {
  @IsIn(RECURRENCE_FREQUENCIES)
  freq: RecurrenceFrequency;

  @IsInt()
  @Min(1)
  @Max(999)
  interval: number;

  /** Weekly only: 0 = Sunday ... 6 = Saturday. */
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  byWeekday: number[];

  /** Monthly and yearly: day of the month (31 = the last day of shorter months). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  byMonthDay: number | null;
}

/** A task as the app stores it, in both directions of a sync. Dates are ISO 8601. */
export class SyncTaskDto {
  /** The app's ID for the task (a UUID, or a hex _id for tasks from before sync). */
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,64}$/, { message: 'id must be 1-64 letters, digits or dashes' })
  id: string;

  @IsString()
  @Length(1, 120)
  title: string;

  @IsString()
  @MaxLength(1000)
  description: string;

  @Type(() => Date)
  @IsDate()
  scheduledAt: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deadline: Date | null;

  @IsIn(TASK_PRIORITIES)
  priority: TaskPriority;

  @IsIn(TASK_CATEGORIES)
  category: TaskCategory;

  @Transform(normalizeTags)
  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @Length(1, 20, { each: true })
  tags: string[];

  @IsBoolean()
  completed: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  completedAt: Date | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_REMINDER_OFFSET_MINUTES)
  reminderOffset: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  recurrence: RecurrenceDto | null;

  /**
   * IANA zone, e.g. Asia/Kolkata. Not rejected when unknown (some phones
   * report zones like "GMT+05:30"): SyncService stores those as null, so one
   * odd setting can't block a phone's whole sync.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone: string | null;

  @Type(() => Date)
  @IsDate()
  createdAt: Date;

  /** When the device last changed it, by the device's clock (last write wins). */
  @Type(() => Date)
  @IsDate()
  updatedAt: Date;

  /** Set when the task was deleted on the device. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deletedAt: Date | null;
}

export class SyncRequestDto {
  /** From the previous sync's answer; absent or null the first time. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string | null;

  /** Tasks changed on the device since they were last sent. */
  @IsArray()
  @ArrayMaxSize(MAX_SYNC_CHANGES)
  @ValidateNested({ each: true })
  @Type(() => SyncTaskDto)
  changes: SyncTaskDto[];
}
