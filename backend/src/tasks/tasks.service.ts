import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { escapeRegex } from '../common/utils/escape-regex';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './schemas/task.schema';
import { TASK_CATEGORIES, TASK_PRIORITIES, TaskCategory, TaskPriority } from './task.constants';
import { sortTasks } from './task-ordering';
import { LeanTask, TaskResponse, toTaskResponse } from './task.response';

export interface TaskStats {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  dueToday: number;
  completedToday: number;
  /** 0..1 */
  completionRate: number;
  byPriority: Record<TaskPriority, number>;
  byCategory: Record<TaskCategory, number>;
}

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private readonly taskModel: Model<Task>) {}

  async findAll(ownerId: string, query: QueryTasksDto): Promise<TaskResponse[]> {
    const now = new Date();
    const filter: FilterQuery<Task> = { owner: new Types.ObjectId(ownerId) };

    switch (query.status) {
      case 'active':
        filter.completed = false;
        break;
      case 'completed':
        filter.completed = true;
        break;
      case 'overdue':
        filter.completed = false;
        filter.deadline = { $ne: null, $lt: now };
        break;
    }
    if (query.priority) filter.priority = query.priority;
    if (query.category) filter.category = query.category;
    if (query.tag) filter.tags = query.tag;
    if (query.search?.trim()) {
      const pattern = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [{ title: pattern }, { description: pattern }];
    }
    if (query.from || query.to) {
      filter.scheduledAt = {
        ...(query.from && { $gte: query.from }),
        ...(query.to && { $lt: query.to }),
      };
    }

    // A personal to-do list is small, so ordering in memory lets every sort
    // (including the computed smart score) share one implementation.
    const tasks = await this.taskModel.find(filter).lean<LeanTask[]>().exec();
    return sortTasks(tasks, query.sort ?? 'smart', now.getTime()).map(toTaskResponse);
  }

  async findOne(ownerId: string, id: string): Promise<TaskResponse> {
    return toTaskResponse(await this.findOwned(ownerId, id));
  }

  async create(ownerId: string, dto: CreateTaskDto): Promise<TaskResponse> {
    const scheduledAt = dto.scheduledAt ?? new Date();
    const deadline = dto.deadline ?? null;
    this.assertDeadlineAfterSchedule(scheduledAt, deadline);

    const task = await this.taskModel.create({
      ...dto,
      scheduledAt,
      deadline,
      owner: new Types.ObjectId(ownerId),
    });
    return toTaskResponse(task.toObject<LeanTask>());
  }

  async update(ownerId: string, id: string, dto: UpdateTaskDto): Promise<TaskResponse> {
    const existing = await this.findOwned(ownerId, id);

    const scheduledAt = dto.scheduledAt ?? existing.scheduledAt;
    const deadline = dto.deadline === undefined ? existing.deadline : dto.deadline;
    if (dto.scheduledAt !== undefined || dto.deadline !== undefined) {
      this.assertDeadlineAfterSchedule(scheduledAt, deadline);
    }

    const changes: Partial<Task> = { ...dto };
    if (dto.completed !== undefined && dto.completed !== existing.completed) {
      changes.completedAt = dto.completed ? new Date() : null;
    }

    const updated = await this.taskModel
      .findOneAndUpdate({ _id: id, owner: ownerId }, { $set: changes }, { new: true })
      .lean<LeanTask>()
      .exec();
    if (!updated) throw new NotFoundException('Task not found');
    return toTaskResponse(updated);
  }

  setCompleted(ownerId: string, id: string, completed: boolean): Promise<TaskResponse> {
    return this.update(ownerId, id, { completed });
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const result = await this.taskModel.deleteOne({ _id: id, owner: ownerId }).exec();
    if (result.deletedCount === 0) throw new NotFoundException('Task not found');
  }

  async removeCompleted(ownerId: string): Promise<{ deleted: number }> {
    const result = await this.taskModel.deleteMany({ owner: ownerId, completed: true }).exec();
    return { deleted: result.deletedCount };
  }

  /**
   * Dashboard numbers. `tzOffset` is the client's `Date#getTimezoneOffset()`
   * so "today" matches the user's wall clock, not the server's.
   */
  async stats(ownerId: string, tzOffset = 0): Promise<TaskStats> {
    const tasks = await this.taskModel
      .find({ owner: ownerId })
      .select('completed completedAt deadline priority category')
      .lean<LeanTask[]>()
      .exec();

    const now = Date.now();
    const offsetMs = tzOffset * 60 * 1000;
    // Midnight in the client's timezone, expressed as a UTC instant.
    const startOfToday = Math.floor((now - offsetMs) / DAY) * DAY + offsetMs;
    const endOfToday = startOfToday + DAY;
    const isToday = (d: Date | null) =>
      d !== null && d.getTime() >= startOfToday && d.getTime() < endOfToday;

    const byPriority = Object.fromEntries(TASK_PRIORITIES.map((p) => [p, 0])) as Record<
      TaskPriority,
      number
    >;
    const byCategory = Object.fromEntries(TASK_CATEGORIES.map((c) => [c, 0])) as Record<
      TaskCategory,
      number
    >;

    let completed = 0;
    let overdue = 0;
    let dueToday = 0;
    let completedToday = 0;
    for (const task of tasks) {
      if (task.completed) {
        completed++;
        if (isToday(task.completedAt)) completedToday++;
        continue;
      }
      byPriority[task.priority]++;
      byCategory[task.category]++;
      if (task.deadline && task.deadline.getTime() < now) overdue++;
      else if (isToday(task.deadline)) dueToday++;
    }

    const total = tasks.length;
    return {
      total,
      active: total - completed,
      completed,
      overdue,
      dueToday,
      completedToday,
      completionRate: total === 0 ? 0 : completed / total,
      byPriority,
      byCategory,
    };
  }

  // ---------------------------------------------------------------------------

  /** Loads a task only if it belongs to the caller; 404 otherwise (no existence leak). */
  private async findOwned(ownerId: string, id: string): Promise<LeanTask> {
    const task = await this.taskModel.findOne({ _id: id, owner: ownerId }).lean<LeanTask>().exec();
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private assertDeadlineAfterSchedule(scheduledAt: Date, deadline: Date | null): void {
    if (deadline && deadline.getTime() < scheduledAt.getTime()) {
      throw new BadRequestException('Deadline cannot be earlier than the scheduled time');
    }
  }
}
