import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PushTokenService } from '../controller/users/push-token.service';
import {
  PushReceipt,
  PushReceiptDocument,
} from './entities/push-receipt.entity';

/**
 * Returns each user's share of the app icon badge (for example their unread
 * task count). Users missing from the map count as 0.
 */
export type BadgeSource = (userIds: string[]) => Promise<Map<string, number>>;

export interface SendPushToUsersResult {
  /** False when at least one chunk could not be submitted to Expo. */
  submitted: boolean;
  /** Number of device tokens the push was sent to. */
  tokenCount: number;
}

/** Expo recommends waiting ~15 minutes before asking for receipts. */
const RECEIPT_MIN_AGE_MS = 15 * 60_000;
const RECEIPT_BATCH_LIMIT = 1000;

@Injectable()
export class NotificationsService {
  private expo: Expo;
  private readonly logger = new Logger(NotificationsService.name);
  private readonly badgeSources = new Map<string, BadgeSource>();

  constructor(
    private configService: ConfigService,
    private pushTokenService: PushTokenService,
    @InjectModel(PushReceipt.name)
    private pushReceiptModel: Model<PushReceiptDocument>,
  ) {
    const accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN');
    this.expo = new Expo({ accessToken });
  }

  private maskToken(token: string): string {
    return token.length > 12
      ? `${token.slice(0, 6)}…${token.slice(-4)}`
      : 'redacted';
  }

  /**
   * Registers a contributor to the app icon badge. The badge sent with
   * `sendPushToUsers` is the sum of every registered source, which must match
   * what the app itself shows (tasks + reviews). Sources register themselves
   * on module init so this service does not depend on their modules.
   */
  registerBadgeSource(name: string, source: BadgeSource): void {
    this.badgeSources.set(name, source);
  }

  /**
   * Sends a push to every device of the given users, with each user's app
   * icon badge set so the icon is right while the app is in the background.
   *
   * If any badge source fails, the push is still sent, without a badge:
   * the app corrects the badge itself when it is next opened.
   */
  async sendPushToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<SendPushToUsersResult> {
    const uniqueIds = [...new Set(userIds.map((id) => id.toString()))];
    if (uniqueIds.length === 0) return { submitted: true, tokenCount: 0 };

    const tokensByUser = await this.pushTokenService.getTokensByUser(uniqueIds);
    if (tokensByUser.size === 0) return { submitted: true, tokenCount: 0 };

    const badges = await this.resolveBadges([...tokensByUser.keys()]);

    // One send per distinct badge value.
    const tokensByBadge = new Map<number | undefined, string[]>();
    for (const [userId, tokens] of tokensByUser) {
      const badge = badges?.get(userId);
      const group = tokensByBadge.get(badge) ?? [];
      group.push(...tokens);
      tokensByBadge.set(badge, group);
    }

    let submitted = true;
    let tokenCount = 0;
    for (const [badge, tokens] of tokensByBadge) {
      tokenCount += tokens.length;
      const ok = await this.sendPush(tokens, title, body, data, { badge });
      submitted = submitted && ok;
    }

    return { submitted, tokenCount };
  }

  /** Sums every badge source per user, or `null` if any source failed. */
  private async resolveBadges(
    userIds: string[],
  ): Promise<Map<string, number> | null> {
    if (this.badgeSources.size === 0) return null;

    try {
      const parts = await Promise.all(
        [...this.badgeSources.values()].map((source) => source(userIds)),
      );
      const totals = new Map<string, number>();
      for (const userId of userIds) {
        totals.set(
          userId,
          parts.reduce((sum, part) => sum + (part.get(userId) ?? 0), 0),
        );
      }
      return totals;
    } catch (err) {
      this.logger.warn('Failed to compute push badge counts', err);
      return null;
    }
  }

  /**
   * Sends a push to the given tokens.
   *
   * Resolves to `false` when at least one chunk could not be submitted to
   * Expo (network/service failure), so callers that need a retry can
   * release their own "already sent" marker. Per-ticket errors such as a
   * dead token are handled here and do not count as a failure.
   */
  async sendPush(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
    options: { badge?: number } = {},
  ): Promise<boolean> {
    const { badge } = options;
    const messages: ExpoPushMessage[] = tokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((to) => ({
        to,
        title,
        body,
        data,
        sound: 'default',
        ...(badge !== undefined ? { badge } : {}),
      }));

    if (!messages.length) return true;

    let allSubmitted = true;
    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        const acceptedTickets: { ticketId: string; token: string }[] = [];

        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === 'ok') {
            const to = chunk[i].to;
            acceptedTickets.push({
              ticketId: ticket.id,
              token: Array.isArray(to) ? to[0] : to,
            });
          } else if (ticket.status === 'error') {
            const messageObj = chunk[i];
            const token = Array.isArray(messageObj.to)
              ? messageObj.to[0]
              : messageObj.to;

            const maskedToken = this.maskToken(token);

            this.logger.error(
              `Push ticket error for ${maskedToken}: ${ticket.message}`,
            );

            if (ticket.details?.error === 'DeviceNotRegistered') {
              this.logger.warn(`Removing dead token: ${maskedToken}`);
              // Fire-and-forget; don't block the push loop
              void this.pushTokenService
                .removeTokenByValue(token)
                .catch((err) =>
                  this.logger.error('Failed to remove dead token', err),
                );
            } else if (ticket.details?.error) {
              this.logger.error(
                `Push ticket error details for ${maskedToken}: ${ticket.details.error}`,
              );
            }
          }
        }

        await this.saveTickets(acceptedTickets);
      } catch (err) {
        allSubmitted = false;
        this.logger.error('Failed to send push notification', err);
        const errorObj = err as {
          response?: { body?: unknown; data?: unknown };
        };
        if (errorObj?.response?.body) {
          this.logger.error(
            'Push notification response body:',
            errorObj.response.body,
          );
        } else if (errorObj?.response?.data) {
          this.logger.error(
            'Push notification response data:',
            errorObj.response.data,
          );
        }
      }
    }

    return allSubmitted;
  }

  /**
   * Remembers accepted tickets so their receipts can be checked later.
   * Never throws: bookkeeping must not make a delivered push look failed.
   */
  private async saveTickets(
    tickets: { ticketId: string; token: string }[],
  ): Promise<void> {
    if (!tickets.length) return;

    try {
      await this.pushReceiptModel.insertMany(tickets, { ordered: false });
    } catch (err) {
      this.logger.warn('Failed to store push tickets for receipt checks', err);
    }
  }

  /**
   * Fetches delivery receipts for tickets older than ~15 minutes.
   *
   * Expo reports most failures here rather than on the ticket:
   * - DeviceNotRegistered: the token is dead, so it is removed.
   * - InvalidCredentials (e.g. a broken APNs key), MessageTooBig,
   *   MessageRateExceeded, ...: logged so they are visible on the server.
   *
   * Receipts Expo has not produced yet are left for the next run (the
   * stored ticket expires after 24h, when Expo drops the receipt anyway).
   */
  @Cron('*/10 * * * *')
  async processReceipts(): Promise<void> {
    try {
      const pending = await this.pushReceiptModel
        .find({
          createdAt: { $lte: new Date(Date.now() - RECEIPT_MIN_AGE_MS) },
        })
        .limit(RECEIPT_BATCH_LIMIT)
        .lean()
        .exec();

      if (pending.length === 0) return;

      const tokenByTicket = new Map(pending.map((p) => [p.ticketId, p.token]));
      const checked: string[] = [];
      let failed = 0;

      for (const ids of this.expo.chunkPushNotificationReceiptIds([
        ...tokenByTicket.keys(),
      ])) {
        try {
          const receipts =
            await this.expo.getPushNotificationReceiptsAsync(ids);

          for (const [ticketId, receipt] of Object.entries(receipts)) {
            if (receipt.status !== 'error') {
              checked.push(ticketId);
              continue;
            }

            const token = tokenByTicket.get(ticketId);
            const maskedToken = token ? this.maskToken(token) : 'unknown';
            const reason = receipt.details?.error ?? 'unknown';

            // A receipt is only marked checked (and its record deleted) once
            // its handling succeeded, so a failed dead-token removal is
            // retried on the next run instead of being lost.
            try {
              if (reason === 'DeviceNotRegistered' && token) {
                await this.pushTokenService.removeTokenByValue(token);
                this.logger.warn(`Removed dead token: ${maskedToken}`);
              }
              checked.push(ticketId);
              failed++;
              this.logger.error(
                `Push receipt error for ${maskedToken} (${reason}): ${receipt.message}`,
              );
            } catch (err) {
              this.logger.error(
                `Failed to handle push receipt error for ${maskedToken} (${reason}); will retry`,
                err,
              );
            }
          }
        } catch (err) {
          this.logger.error('Failed to fetch push receipts', err);
        }
      }

      if (checked.length > 0) {
        await this.pushReceiptModel
          .deleteMany({ ticketId: { $in: checked } })
          .exec();
      }

      this.logger.log(
        `Checked ${checked.length}/${pending.length} push receipt(s); ${failed} reported an error.`,
      );
    } catch (err) {
      this.logger.error('Error in processReceipts cron job', err);
    }
  }
}
