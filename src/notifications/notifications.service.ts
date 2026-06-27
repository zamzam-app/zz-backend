import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PushTokenService } from '../controller/users/push-token.service';

@Injectable()
export class NotificationsService {
  private expo: Expo;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private configService: ConfigService,
    private pushTokenService: PushTokenService,
  ) {
    const accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN');
    this.expo = new Expo({ accessToken });
  }

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
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);

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
      } catch (err) {
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
  }
}
