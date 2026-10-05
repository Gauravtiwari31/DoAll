import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, FilterQuery, Model, Types } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import { Recurrence, Task } from '../tasks/schemas/task.schema';
import { TOMBSTONE_CONTENT, TOMBSTONE_RETENTION_DAYS } from '../tasks/task.constants';
import { isEmailVerified } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { SyncRequestDto, SyncTaskDto } from './dto/sync.dto';

/** A task in a sync answer: the same shape the app sends. */
export interface SyncTask {
  id: string;
  title: string;
  description: string;
  scheduledAt: Date;
  deadline: Date | null;
  priority: Task['priority'];
  category: Task['category'];
  tags: string[];
  completed: boolean;
  completedAt: Date | null;
  reminderOffset: number | null;
  recurrence: Recurrence | null;
  timeZone: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface SyncResponse {
  /** Tasks changed on the server since the cursor, plus current versions of refused changes. */
  changes: SyncTask[];
  /** Send this back next time. */
  cursor: string;
  /** More changes are waiting: sync again straight away. */
  hasMore: boolean;
  /**
   * The device was away longer than tombstones are kept, so it may have missed
   * deletions: it should drop the tasks it has already synced and take these.
   */
  reset: boolean;
}

/** `code` of the 403 sent while the account's email address isn't confirmed. */
export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

/** Most tasks one answer carries; `hasMore` asks for the rest. */
export const SYNC_PAGE_SIZE = 500;

/**
 * Changes stored in the last few seconds aren't handed out yet. Their
 * serverUpdatedAt was taken just before the write, so a write that is slow to
 * finish could otherwise land behind a cursor that has already moved past it.
 */
export const SETTLE_MS = 5_000;

/** A device clock this far ahead is wrong, and must not make its changes win forever. */
const MAX_CLOCK_AHEAD_MS = 5 * 60 * 1000;

const RESET_AFTER_MS = (TOMBSTONE_RETENTION_DAYS - 5) * 24 * 60 * 60 * 1000;

type LeanTask = Task & { _id: Types.ObjectId };

interface Cursor {
  /** serverUpdatedAt of the last task handed out, in ms. */
  at: number;
  /** Its uid, which orders tasks stored in the same millisecond. */
  id: string;
}

const encodeCursor = ({ at, id }: Cursor) => `${at}_${id}`;

function decodeCursor(cursor: string | null | undefined): Cursor | null {
  const match = /^(\d{1,15})_([A-Za-z0-9-]*)$/.exec(cursor ?? '');
  return match ? { at: Number(match[1]), id: match[2] } : null;
}

const toSyncTask = (task: LeanTask): SyncTask => ({
  id: task.uid,
  title: task.title,
  description: task.description ?? '',
  scheduledAt: task.scheduledAt,
  deadline: task.deadline ?? null,
  priority: task.priority,
  category: task.category,
  tags: task.tags ?? [],
  completed: task.completed,
  completedAt: task.completedAt ?? null,
  reminderOffset: task.reminderOffset ?? null,
  recurrence: task.recurrence ?? null,
  timeZone: task.timeZone ?? null,
  createdAt: task.createdAt,
  updatedAt: task.clientUpdatedAt ?? task.updatedAt,
  deletedAt: task.deletedAt ?? null,
});

/** The zone if it's a real IANA time zone, otherwise null. */
function knownTimeZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

/** Duplicate-key write errors of a bulk write, by the index of the operation. */
function duplicateKeyIndexes(error: unknown): number[] | null {
  const writeErrors = (error as { writeErrors?: { index: number; code: number }[] }).writeErrors;
  if (!Array.isArray(writeErrors) || writeErrors.some((e) => e.code !== 11000)) return null;
  return writeErrors.map((e) => e.index);
}

/**
 * Two-way sync between the app's on-device database and the server.
 *
 * One request pushes the device's changes, then pulls what changed on the
 * server since the device's cursor:
 * - Conflicts are settled per task by last write wins: a change is stored
 *   only if its `updatedAt` (device clock) is later than the stored one.
 *   Refused changes come back in the answer, so the device takes the winner.
 * - Pulls follow the server's own clock (`serverUpdatedAt`), never device
 *   clocks, so devices whose clocks disagree still see every change.
 * - Deletions are tombstones (`deletedAt`), kept for TOMBSTONE_RETENTION_DAYS.
 * - Replaying a request is harmless: the same changes are simply refused as
 *   not newer, and the pull returns the same tasks again.
 */
@Injectable()
export class SyncService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<Task>,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  async sync(ownerId: string, { cursor, changes }: SyncRequestDto): Promise<SyncResponse> {
    // Downloading your own tasks is always fine; storing new ones waits.
    if (changes.length > 0) await this.assertMayBackUp(ownerId);
    const owner = new Types.ObjectId(ownerId);
    const now = Date.now();

    const refusedIds = await this.push(owner, changes, now);

    const from = decodeCursor(cursor);
    // A device that was away longer than tombstones live may have missed deletions.
    const reset = from !== null && from.at < now - RESET_AFTER_MS;
    const start = reset ? null : from;

    const filter: FilterQuery<Task> = {
      owner,
      serverUpdatedAt: { $lte: new Date(now - SETTLE_MS) },
    };
    if (start) {
      filter.$or = [
        { serverUpdatedAt: { $gt: new Date(start.at) } },
        { serverUpdatedAt: new Date(start.at), uid: { $gt: start.id } },
      ];
    } else {
      // Starting from nothing: deletions don't concern this device.
      filter.deletedAt = null;
    }
    const pulled = await this.taskModel
      .find(filter)
      .sort({ serverUpdatedAt: 1, uid: 1 })
      .limit(SYNC_PAGE_SIZE)
      .lean<LeanTask[]>()
      .exec();

    const last = pulled.at(-1);
    const next: Cursor = last
      ? { at: last.serverUpdatedAt.getTime(), id: last.uid }
      : // Nothing new. Without a cursor yet, start from the oldest change this answer covered.
        (start ?? { at: 0, id: '' });

    // The winning versions of refused changes, unless the pull has them already.
    const pulledIds = new Set(pulled.map((task) => task.uid));
    const missing = refusedIds.filter((id) => !pulledIds.has(id));
    const winners = missing.length
      ? await this.taskModel
          .find({ owner, uid: { $in: missing } })
          .lean<LeanTask[]>()
          .exec()
      : [];

    return {
      changes: [...pulled, ...winners].map(toSyncTask),
      cursor: encodeCursor(next),
      hasMore: pulled.length === SYNC_PAGE_SIZE,
      reset,
    };
  }

  /** Stores the newer changes; returns the IDs of those refused as older than the server's. */
  private async push(
    owner: Types.ObjectId,
    changes: SyncTaskDto[],
    now: number,
  ): Promise<string[]> {
    if (changes.length === 0) return [];
    const serverUpdatedAt = new Date(now);
    const latest = new Date(now + MAX_CLOCK_AHEAD_MS);

    const operations: AnyBulkWriteOperation<Task>[] = changes.map((change) => {
      const clientUpdatedAt = change.updatedAt > latest ? latest : change.updatedAt;
      return {
        updateOne: {
          // Matches only if this change is newer. Otherwise the upsert tries to
          // insert a second task with the same uid, and the unique index refuses it.
          filter: { owner, uid: change.id, clientUpdatedAt: { $lt: clientUpdatedAt } },
          update: {
            $set: {
              title: change.title,
              description: change.description,
              scheduledAt: change.scheduledAt,
              deadline: change.deadline ?? null,
              priority: change.priority,
              category: change.category,
              tags: change.tags,
              completed: change.completed,
              completedAt: change.completedAt ?? null,
              reminderOffset: change.reminderOffset ?? null,
              recurrence: change.recurrence ?? null,
              timeZone: knownTimeZone(change.timeZone),
              deletedAt: change.deletedAt ?? null,
              // A deletion keeps nothing the user wrote.
              ...(change.deletedAt && { ...TOMBSTONE_CONTENT, tags: [] }),
              clientUpdatedAt,
              serverUpdatedAt,
              updatedAt: serverUpdatedAt,
            },
            $setOnInsert: { createdAt: change.createdAt },
          },
          upsert: true,
          // createdAt comes from the device, updatedAt is set above.
          timestamps: false,
        },
      };
    });

    try {
      await this.taskModel.bulkWrite(operations, { ordered: false });
      return [];
    } catch (error) {
      const refused = duplicateKeyIndexes(error);
      if (!refused) throw error;
      return refused.map((index) => changes[index].id);
    }
  }

  /**
   * Storing changes waits for a confirmed address, when the server can send
   * the confirmation email. Pulls don't, so a phone can still download the
   * tasks an account already has (from before email confirmation existed).
   */
  private async assertMayBackUp(ownerId: string): Promise<void> {
    if (!this.auth.emailVerificationRequired) return;
    const user = await this.users.findById(ownerId);
    if (user && !isEmailVerified(user)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: EMAIL_NOT_VERIFIED,
        message: 'Confirm your email address to back up and sync your tasks.',
      });
    }
  }
}
