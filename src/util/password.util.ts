import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = parseInt(process.env.PASSWORD_SALT_ROUNDS ?? '10');

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}
