import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PushTokenService } from '../controller/users/push-token.service';

// ─── Retry configuration ─────────────────────────────────────────────────────
// Tune these values without touching the retry logic below.
const RETRY_ATTEMPTS = 1;
const RETRY_DELAY_MS = 500;
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationsService {
  private expo: Expo;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private configService: ConfigService,
    private pushTokenService: PushTokenService,
  ) {
    const accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN');

    // ── Startup guard ──────────────────────────────────────────────────────
    // Without a valid access token Expo Enhanced Push (priority/receipts) will
    // silently degrade or fail in production. Fail fast so it is immediately
    // visible rather than discovered hours later in missing notifications.
    if (!accessToken) {
      this.logger.error(
        'EXPO_ACCESS_TOKEN is not set. ' +
          'Push notifications will not work correctly. ' +
          'Set the variable in your .env / deployment config and restart.',
      );
      process.exit(1);
    }
    // ──────────────────────────────────────────────────────────────────────

    this.expo = new Expo({ accessToken });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Returns true for errors that are worth a single retry (network / 5xx). */
  private isTransientError(err: unknown): boolean {
    const e = err as {
      code?: string;
      status?: number;
      response?: { status?: number };
    };
    // Node fetch / axios network errors
    if (
      e?.code === 'ECONNRESET' ||
      e?.code === 'ETIMEDOUT' ||
      e?.code === 'ENOTFOUND'
    ) {
      return true;
    }
    // HTTP-level 5xx
    const status = e?.status ?? e?.response?.status;
    if (typeof status === 'number' && status >= 500) {
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Core ─────────────────────────────────────────────────────────────────

  async sendPush(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    const messages: ExpoPushMessage[] = tokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((to) => ({ to, title, body, data, sound: 'default' }));

    if (!messages.length) return;

    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      await this.sendChunkWithRetry(chunk);
    }
  }

  /**
   * Sends one chunk to Expo, retrying up to RETRY_ATTEMPTS times on transient
   * errors after a RETRY_DELAY_MS pause. Ticket-level errors (DeviceNotRegistered
   * etc.) are handled after a successful HTTP call and are never retried.
   */
  private async sendChunkWithRetry(chunk: ExpoPushMessage[]): Promise<void> {
    let lastErr: unknown;

    for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        this.logger.warn(
          `Retrying push chunk (attempt ${attempt}/${RETRY_ATTEMPTS}) after ${RETRY_DELAY_MS} ms…`,
        );
        await this.sleep(RETRY_DELAY_MS);
      }

      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        this.handleTickets(tickets, chunk);
        return; // success — exit retry loop
      } catch (err) {
        lastErr = err;

        if (this.isTransientError(err) && attempt < RETRY_ATTEMPTS) {
          // Will retry on next iteration
          this.logger.warn(
            'Transient push error, will retry:',
            (err as Error)?.message,
          );
          continue;
        }

        // Non-transient or retries exhausted — log and bail
        this.logger.error('Failed to send push notification chunk', err);
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
        return;
      }
    }

    // Exhausted retries without a clean return — log final error
    this.logger.error(
      `Push chunk failed after ${RETRY_ATTEMPTS} retries`,
      lastErr,
    );
  }

  /**
   * Processes Expo ticket-level errors returned from a successful HTTP call.
   * DeviceNotRegistered → remove dead token (fire-and-forget).
   * Other errors → log only; no retry here (these are logical, not transient).
   */
  private handleTickets(
    tickets: Awaited<ReturnType<Expo['sendPushNotificationsAsync']>>,
    chunk: ExpoPushMessage[],
  ): void {
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'error') {
        const messageObj = chunk[i];
        const token = Array.isArray(messageObj.to)
          ? messageObj.to[0]
          : messageObj.to;

        const maskedToken =
          token.length > 12
            ? `${token.slice(0, 6)}…${token.slice(-4)}`
            : 'redacted';

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
  }
}
