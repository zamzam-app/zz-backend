import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './entities/user.entity';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { Expo } from 'expo-server-sdk';

@Injectable()
export class PushTokenService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  /**
   * Upsert a token into the user's pushTokens array.
   * Also mirrors into legacy pushToken for backward-compat reads.
   */
  async upsertToken(userId: string, dto: UpdatePushTokenDto): Promise<void> {
    const tokenStr = dto.pushToken.trim();
    if (!Expo.isExpoPushToken(tokenStr)) {
      throw new BadRequestException('Invalid Expo push token');
    }

    const now = new Date();

    // Pull any existing token that matches the token string or device ID
    const pullExpr = dto.deviceId
      ? { $or: [{ token: tokenStr }, { deviceId: dto.deviceId }] }
      : { token: tokenStr };

    await this.userModel
      .updateOne(
        { _id: new Types.ObjectId(userId) },

        { $pull: { pushTokens: pullExpr } },
      )
      .exec();

    const tokenObj = {
      token: tokenStr,
      platform: dto.platform || 'unknown',
      deviceId: dto.deviceId,
      appVersion: dto.appVersion,
      lastSeenAt: now,
      createdAt: now,
    };

    // Push the updated token and mirror to legacy pushToken field
    await this.userModel
      .updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $push: { pushTokens: tokenObj },
          $set: { pushToken: tokenStr },
        },
      )
      .exec();
  }

  /**
   * Remove a specific token (by deviceId or raw token value) from a user.
   * Called on logout with the current device's token.
   */
  async removeToken(
    userId: string,
    opts: { token?: string; deviceId?: string },
  ): Promise<void> {
    if (!opts.token && !opts.deviceId) return;

    const pullExpr = opts.deviceId
      ? { deviceId: opts.deviceId }
      : { token: opts.token };

    await this.userModel
      .updateOne(
        { _id: new Types.ObjectId(userId) },

        { $pull: { pushTokens: pullExpr } },
      )
      .exec();
  }

  /**
   * Remove a token by its raw string value across ALL users.
   * Called by NotificationsService when Expo reports DeviceNotRegistered.
   */
  async removeTokenByValue(token: string): Promise<void> {
    if (!token) return;

    await this.userModel
      .updateMany(
        { 'pushTokens.token': token },

        { $pull: { pushTokens: { token } } },
      )
      .exec();

    // Also clear legacy field if it matches exactly
    await this.userModel
      .updateMany({ pushToken: token }, { $unset: { pushToken: 1 } })
      .exec();
  }

  /**
   * Collect all valid push tokens for a list of user IDs.
   * Reads from pushTokens[] and falls back to legacy pushToken for users
   * who haven't synced yet. Returns a deduped string[].
   */
  async getTokensForUsers(userIds: string[]): Promise<string[]> {
    if (!userIds || !userIds.length) return [];

    const uniqueIds = [...new Set(userIds.map((id) => id.toString()))];
    const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));

    const users = await this.userModel
      .find(
        { _id: { $in: objectIds }, isDeleted: false },
        { pushToken: 1, pushTokens: 1 },
      )
      .lean()
      .exec();

    const allTokens: string[] = [];

    for (const user of users) {
      // Add from pushTokens array
      if (Array.isArray(user.pushTokens)) {
        for (const pt of user.pushTokens) {
          if (pt && pt.token && Expo.isExpoPushToken(pt.token)) {
            allTokens.push(pt.token);
          }
        }
      }

      // Add from legacy field
      if (user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
        allTokens.push(user.pushToken);
      }
    }

    // Dedupe
    return [...new Set(allTokens)];
  }
}
