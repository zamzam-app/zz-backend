import {
  Injectable,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './entities/user.entity';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { Expo } from 'expo-server-sdk';

@Injectable()
export class PushTokenService implements OnModuleInit {
  private readonly logger = new Logger(PushTokenService.name);

  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  onModuleInit(): void {
    // Don't hold up startup; failures are logged and retried on the next boot.
    void this.migrateLegacyTokens().catch((error) =>
      this.logger.error('Legacy push token migration failed', error),
    );
  }

  /**
   * One-off, idempotent migration: copies each user's legacy `pushToken` into
   * `pushTokens[]` so `getTokensForUsers` can stop reading the legacy field
   * without silencing users who haven't re-synced since the multi-device
   * change. The migrated entry has no `deviceId`, so the app is told
   * `tokenSyncRequired` and replaces it with a full entry on its next sync.
   *
   * A token already owned by another user (unique index on
   * `pushTokens.token`) is skipped: that user is its current owner.
   *
   * Safe to delete once it reports 0 users to migrate in production.
   */
  async migrateLegacyTokens(): Promise<void> {
    const candidates = await this.userModel
      .find({
        pushToken: { $type: 'string', $ne: '' },
        $expr: {
          $not: [
            {
              $in: ['$pushToken', { $ifNull: ['$pushTokens.token', []] }],
            },
          ],
        },
      })
      .select('_id pushToken')
      .lean()
      .exec();

    if (candidates.length === 0) return;

    let migrated = 0;
    let skipped = 0;
    const now = new Date();

    for (const user of candidates) {
      const token = user.pushToken;
      if (!token || !Expo.isExpoPushToken(token)) {
        skipped++;
        continue;
      }

      try {
        const result = await this.userModel
          .updateOne(
            { _id: user._id, 'pushTokens.token': { $ne: token } },
            {
              $push: {
                pushTokens: {
                  token,
                  platform: 'unknown',
                  lastSeenAt: now,
                  createdAt: now,
                },
              },
            },
          )
          .exec();
        migrated += result.modifiedCount;
      } catch (error) {
        // 11000 = token already belongs to another user; leave it with them.
        if ((error as { code?: number })?.code !== 11000) throw error;
        skipped++;
      }
    }

    this.logger.log(
      `Legacy push token migration: ${migrated} migrated, ${skipped} skipped, ${candidates.length} candidate(s).`,
    );
  }

  /**
   * Upsert a token into the user's pushTokens array.
   * Also mirrors into legacy pushToken for backward-compat reads.
   */
  async upsertToken(userId: string, dto: UpdatePushTokenDto): Promise<void> {
    try {
      const tokenStr = dto.pushToken.trim();
      if (!Expo.isExpoPushToken(tokenStr)) {
        throw new BadRequestException('Invalid Expo push token');
      }

      // Remove this token from any other user before assigning it to the current one.
      // Prevents unique index collision when a device is re-used across accounts.
      await this.removeTokenByValue(tokenStr);

      const now = new Date();

      const tokenObj = {
        token: tokenStr,
        platform: dto.platform || 'unknown',
        deviceId: dto.deviceId || null,
        appVersion: dto.appVersion || null,
        lastSeenAt: now,
        createdAt: now,
      };

      await this.userModel
        .updateOne(
          { _id: new Types.ObjectId(userId) },
          [
            {
              $set: {
                pushTokens: {
                  $concatArrays: [
                    {
                      $filter: {
                        input: { $ifNull: ['$pushTokens', []] },
                        as: 'pt',
                        cond: {
                          $and: [
                            { $ne: ['$$pt.token', tokenStr] },
                            ...(dto.deviceId
                              ? [{ $ne: ['$$pt.deviceId', dto.deviceId] }]
                              : []),
                          ],
                        },
                      },
                    },
                    [tokenObj],
                  ],
                },
                pushToken: tokenStr,
              },
            },
          ],
          { updatePipeline: true },
        )
        .exec();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to upsert push token',
      );
    }
  }

  /**
   * Remove a specific token (by deviceId or raw token value) from a user.
   * Called on logout with the current device's token.
   */
  async removeToken(
    userId: string,
    opts: { token?: string; deviceId?: string },
  ): Promise<void> {
    try {
      if (!opts.token && !opts.deviceId) return;

      await this.userModel
        .updateOne(
          { _id: new Types.ObjectId(userId) },
          [
            {
              $set: {
                pushTokens: {
                  $filter: {
                    input: { $ifNull: ['$pushTokens', []] },
                    as: 'pt',
                    cond: {
                      $and: [
                        ...(opts.token
                          ? [{ $ne: ['$$pt.token', opts.token] }]
                          : []),
                        ...(opts.deviceId
                          ? [{ $ne: ['$$pt.deviceId', opts.deviceId] }]
                          : []),
                      ],
                    },
                  },
                },
              },
            },
            {
              $set: {
                pushToken: {
                  $let: {
                    vars: {
                      tokens: { $ifNull: ['$pushTokens', []] },
                    },
                    in: {
                      $cond: {
                        if: { $gt: [{ $size: '$$tokens' }, 0] },
                        then: { $arrayElemAt: ['$$tokens.token', -1] },
                        else: null,
                      },
                    },
                  },
                },
              },
            },
          ],
          { updatePipeline: true },
        )
        .exec();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to remove push token',
      );
    }
  }

  /**
   * Remove a token by its raw string value across ALL users.
   * Called by NotificationsService when Expo reports DeviceNotRegistered.
   */
  async removeTokenByValue(token: string): Promise<void> {
    try {
      if (!token) return;

      await this.userModel
        .updateMany(
          { 'pushTokens.token': token },

          { $pull: { pushTokens: { token } } },
        )
        .exec();

      // Also clear legacy field if it matches exactly
      await this.userModel
        .updateMany(
          { pushToken: token },
          [
            {
              $set: {
                pushToken: {
                  $let: {
                    vars: { remaining: { $ifNull: ['$pushTokens', []] } },
                    in: {
                      $cond: {
                        if: { $gt: [{ $size: '$$remaining' }, 0] },
                        then: { $arrayElemAt: ['$$remaining.token', -1] },
                        else: null,
                      },
                    },
                  },
                },
              },
            },
          ],
          { updatePipeline: true },
        )
        .exec();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to remove push token by value',
      );
    }
  }

  /**
   * Collect all valid push tokens for a list of user IDs.
   * Reads from pushTokens[] only; the legacy `pushToken` field is migrated
   * into it on startup (see `migrateLegacyTokens`). Returns a deduped string[].
   */
  async getTokensForUsers(userIds: string[]): Promise<string[]> {
    try {
      if (!userIds || !userIds.length) return [];

      const uniqueIds = [...new Set(userIds.map((id) => id.toString()))];
      const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));

      const users = await this.userModel
        .find({ _id: { $in: objectIds }, isDeleted: false })
        .select('pushTokens _id')
        .lean()
        .exec();

      const allTokens: string[] = [];

      for (const user of users) {
        if (Array.isArray(user.pushTokens)) {
          for (const pt of user.pushTokens) {
            if (pt && pt.token && Expo.isExpoPushToken(pt.token)) {
              allTokens.push(pt.token);
            }
          }
        }
      }

      // Dedupe
      return [...new Set(allTokens)];
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        (error as Error)?.message ?? 'Failed to retrieve push tokens for users',
      );
    }
  }
}
