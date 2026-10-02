import { createHash, randomInt } from 'node:crypto';
import { BusinessRuleError } from '../../../shared/domain/errors.js';

export const PHONE_CODE_TTL_MINUTES = 10;
export const PHONE_CODE_MAX_ATTEMPTS = 5;

export function generatePhoneCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashPhoneCode(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

export interface PendingVerification {
  codeHash: string;
  attempts: number;
  expiresAt: Date;
}

/** Throws with a customer-facing message when the code cannot be accepted. */
export function assertCodeMatches(pending: PendingVerification | null, userId: string, code: string, now = new Date()) {
  if (!pending) throw new BusinessRuleError('Peça um novo código de verificação.', 'code_missing');
  if (pending.expiresAt < now) throw new BusinessRuleError('O código expirou. Peça um novo.', 'code_expired');
  if (pending.attempts >= PHONE_CODE_MAX_ATTEMPTS) {
    throw new BusinessRuleError('Muitas tentativas. Peça um novo código.', 'code_locked');
  }
  if (pending.codeHash !== hashPhoneCode(userId, code.trim())) {
    throw new BusinessRuleError('Código incorreto.', 'code_invalid');
  }
}
