import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshSession, User, UserDocument } from './schemas/user.schema';

/** Data-access layer for users. Business rules live in AuthService. */
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  create(data: { name: string; email: string; passwordHash: string }): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  /** Includes the password hash and sessions, which are excluded from normal queries. */
  findByEmailWithSecrets(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash +sessions')
      .exec();
  }

  findByIdWithSessions(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+sessions').exec();
  }

  async replaceSessions(userId: string, sessions: RefreshSession[]): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { sessions } }).exec();
  }
}
