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

  /**
   * bcrypt hash. `select: false` keeps it out of every query by default.
   * Missing for accounts created with Google, which have no password.
   */
  @Prop({ select: false })
  passwordHash?: string;

  /**
   * Google's ID for the account (the ID token's `sub`) once the user has
   * signed in with Google. Sparse, so only accounts that have one are indexed.
   */
  @Prop({ unique: true, sparse: true })
  googleId?: string;

  /** Active refresh sessions (one per signed-in device), capped in AuthService. */
  @Prop({ type: [RefreshSessionSchema], default: [], select: false })
  sessions: RefreshSession[];

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

/** Ways an account can sign in. */
export type SignInMethod = 'password' | 'google';

/** Public shape returned by the API — never leaks hashes or sessions. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  /** Lets the app ask for the right confirmation, e.g. before deleting the account. */
  signInMethods: SignInMethod[];
  createdAt: Date;
}

/**
 * `passwordHash` is `select: false`, so the document must come from a query
 * that loads it (the `…WithSecrets` lookups), or from `create()`. Otherwise
 * a password account would be reported as Google-only.
 */
export const toPublicUser = (user: UserDocument): PublicUser => ({
  id: user.id as string,
  name: user.name,
  email: user.email,
  signInMethods: [
    ...(user.passwordHash ? (['password'] as const) : []),
    ...(user.googleId ? (['google'] as const) : []),
  ],
  createdAt: user.createdAt,
});
