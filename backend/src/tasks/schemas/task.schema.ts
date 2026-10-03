import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  type TaskCategory,
  type TaskPriority,
} from '../task.constants';

@Schema({ timestamps: true })
export class Task {
  /** Owner — every query is scoped by this field so users only see their own tasks. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title: string;

  @Prop({ trim: true, maxlength: 1000, default: '' })
  description: string;

  /** When the user plans to work on the task ("date-time"). */
  @Prop({ required: true })
  scheduledAt: Date;

  /** Hard due date. Optional — not every task has one. */
  @Prop({ type: Date, default: null })
  deadline: Date | null;

  @Prop({ type: String, enum: TASK_PRIORITIES, default: 'medium' })
  priority: TaskPriority;

  @Prop({ type: String, enum: TASK_CATEGORIES, default: 'personal' })
  category: TaskCategory;

  /** Free-form labels, normalised to lowercase. */
  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: false })
  completed: boolean;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type TaskDocument = HydratedDocument<Task>;
export const TaskSchema = SchemaFactory.createForClass(Task);

// Supports the common "my open tasks by deadline" access pattern.
TaskSchema.index({ owner: 1, completed: 1, deadline: 1 });
