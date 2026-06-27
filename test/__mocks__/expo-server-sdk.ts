export class Expo {
  constructor() {}

  static isExpoPushToken(): boolean {
    return true;
  }

  chunkPushNotifications<T>(messages: T[]): T[][] {
    return [messages];
  }

  sendPushNotificationsAsync(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}
