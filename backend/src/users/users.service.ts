import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshSession, User, UserDocument } from './schemas/user.schema';

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

  /** Removes the user document, and with it every refresh session it holds. */
  async deleteById(id: string): Promise<void> {
    await this.userModel.deleteOne({ _id: id }).exec();
  }
}
