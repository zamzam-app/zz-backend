import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private expo: Expo;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private configService: ConfigService) {
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

        tickets.forEach((ticket, index) => {
          if (ticket.status === 'error') {
            const messageObj = chunk[index];
            // 'to' can be a string or string[], but we passed a single string in the map function above.
            const token = Array.isArray(messageObj.to)
              ? messageObj.to.join(', ')
              : messageObj.to;

            const maskedToken =
              token.length > 12
                ? `${token.slice(0, 6)}…${token.slice(-4)}`
                : 'redacted';

            this.logger.error(
              `Push ticket error for ${maskedToken}: ${ticket.message}`,
            );

            const errorType = ticket.details?.error;
            if (errorType === 'DeviceNotRegistered') {
              this.logger.warn(
                `Dead Expo token detected for ${maskedToken} - should be removed from DB`,
              );
            } else if (errorType) {
              this.logger.error(
                `Push ticket error details for ${maskedToken}: ${errorType}`,
              );
            }
          }
        });
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
