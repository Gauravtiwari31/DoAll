import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * One active login session. We keep only the SHA-256 of the refresh token so a
 * database leak cannot be replayed against the API.
 */
@Schema({ _id: false })
export class RefreshSession {
  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, maxlength: 50 })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  /** bcrypt hash. `select: false` keeps it out of every query by default. */
  @Prop({ required: true, select: false })
  passwordHash: string;

  /** Active refresh sessions (one per signed-in device), capped in AuthService. */
  @Prop({ type: [RefreshSessionSchema], default: [], select: false })
  sessions: RefreshSession[];

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

/** Public shape returned by the API — never leaks hashes or sessions. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export const toPublicUser = (user: UserDocument): PublicUser => ({
  id: user.id as string,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});
