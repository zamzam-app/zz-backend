import { randomInt } from 'node:crypto';

const OTP_LENGTH = 6;
const OTP_MIN = 10 ** (OTP_LENGTH - 1); // 100_000
const OTP_MAX = 10 ** OTP_LENGTH - 1; // 999_999

/**
 * Generates a cryptographically secure 6-digit OTP (100000–999999).
 */
export function createOtp(): string {
  const value = randomInt(OTP_MIN, OTP_MAX + 1);
  return value.toString();
}
