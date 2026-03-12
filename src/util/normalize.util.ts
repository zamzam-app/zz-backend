/**
 * Normalizes email for consistent storage and lookup (trim + lowercase).
 * Returns empty string if input is falsy.
 */
export function normalizeEmail(email: string | undefined | null): string {
  if (email == null || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Normalizes phone number for consistent storage and lookup (trim + remove internal spaces).
 * Use when matching so "+91 8848746391" and "+918848746391" are treated the same.
 */
export function normalizePhoneNumber(
  phoneNumber: string | undefined | null,
): string {
  if (phoneNumber == null || typeof phoneNumber !== 'string') return '';
  return phoneNumber.trim().replace(/\s/g, '');
}
