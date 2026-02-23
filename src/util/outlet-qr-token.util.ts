import { createHash, randomBytes } from 'node:crypto';

export function generateOutletQrToken(
  outletId: string,
  uniqueSeed?: string,
): string {
  const seed = uniqueSeed ?? randomBytes(16).toString('hex');
  const hash = createHash('sha256')
    .update(`${outletId}:${seed}`)
    .digest('base64url');
  return hash;
}
