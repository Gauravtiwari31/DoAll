import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshSession, User, UserDocument } from './schemas/user.schema';

/** The two kinds of emailed link: confirming the address, and choosing a new password. */
export type EmailTokenKind = 'verify' | 'reset';

const tokenFields = (kind: EmailTokenKind) =>
  kind === 'verify'
    ? ({ hash: 'verifyTokenHash', expiresAt: 'verifyTokenExpiresAt' } as const)
    : ({ hash: 'resetTokenHash', expiresAt: 'resetTokenExpiresAt' } as const);

/** Data-access layer for users. Business rules live in AuthService. */
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  /** A new account has a password, a Google ID, or (after linking) both. */
  create(data: {
    name: string;
    email: string;
    passwordHash?: string;
    googleId?: string;
  }): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  /** Includes the password hash and sessions, which are excluded from normal queries. */
  findByGoogleIdWithSecrets(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).select('+passwordHash +sessions').exec();
  }

  /**
   * Connects a Google account to an existing account that has none yet.
   * Returns false if the account already had one (or no longer exists).
   */
  async linkGoogleAccount(userId: string, googleId: string): Promise<boolean> {
    const result = await this.userModel
      .updateOne({ _id: userId, googleId: { $exists: false } }, { $set: { googleId } })
      .exec();
    return result.modifiedCount === 1;
  }

  /** Includes the password hash and sessions, which are excluded from normal queries. */
  findByEmailWithSecrets(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash +sessions')
      .exec();
  }

  /** Includes the password hash and sessions, which are excluded from normal queries. */
  findByIdWithSecrets(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+passwordHash +sessions').exec();
  }

  /** Cheap existence check by id (no document is loaded). */
  async exists(id: string): Promise<boolean> {
    return (await this.userModel.exists({ _id: id }).exec()) !== null;
  }

  findByIdWithSessions(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+sessions').exec();
  }

  async replaceSessions(userId: string, sessions: RefreshSession[]): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { sessions } }).exec();
  }

  /** Remembers the hash of a newly emailed token, replacing any earlier one of that kind. */
  async setEmailToken(
    userId: string,
    kind: EmailTokenKind,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const fields = tokenFields(kind);
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { [fields.hash]: tokenHash, [fields.expiresAt]: expiresAt } },
      )
      .exec();
  }

  /** The account an unexpired emailed token belongs to, with its secrets. */
  findByEmailToken(kind: EmailTokenKind, tokenHash: string): Promise<UserDocument | null> {
    const fields = tokenFields(kind);
    return this.userModel
      .findOne({ [fields.hash]: tokenHash, [fields.expiresAt]: { $gt: new Date() } })
      .select('+passwordHash +sessions')
      .exec();
  }

  /** Marks the address as confirmed and retires the verification link. */
  async markEmailVerified(userId: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { emailVerified: true }, $unset: { verifyTokenHash: 1, verifyTokenExpiresAt: 1 } },
      )
      .exec();
  }

  /**
   * Sets a new password from a reset link and signs every device out. Using
   * the link also proves the address works, so it counts as verified. Only
   * succeeds while the link is still the current one (each link works once).
   */
  async resetPassword(userId: string, tokenHash: string, passwordHash: string): Promise<boolean> {
    const result = await this.userModel
      .updateOne(
        { _id: userId, resetTokenHash: tokenHash },
        {
          $set: { passwordHash, sessions: [], emailVerified: true },
          $unset: {
            resetTokenHash: 1,
            resetTokenExpiresAt: 1,
            verifyTokenHash: 1,
            verifyTokenExpiresAt: 1,
          },
        },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  /** Removes the user document, and with it every refresh session it holds. */
  async deleteById(id: string): Promise<void> {
    await this.userModel.deleteOne({ _id: id }).exec();
  }
}
