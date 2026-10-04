/** Pacing rules for the outbound WhatsApp queue (see AppConfig.whatsappQueue). */
export interface QueuePolicy {
  minIntervalMs: number;
  perPhoneIntervalMs: number;
  perMinuteLimit: number;
  maxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
}

export interface QueueWindow {
  now: number;
  /** When the worker last handed a message to the gateway, any number. */
  lastSentAt: number | null;
  /** Sends completed in the trailing 60s. */
  sentLastMinute: number;
}

export type QueueBlock = 'interval' | 'per-minute';

/**
 * Whether the worker may send *anything* right now. Returns the reason it may
 * not, so the caller can log a queue that is being held back on purpose.
 */
export function globalBlock(w: QueueWindow, p: QueuePolicy): QueueBlock | null {
  if (w.sentLastMinute >= p.perMinuteLimit) return 'per-minute';
  if (w.lastSentAt !== null && w.now - w.lastSentAt < p.minIntervalMs) return 'interval';
  return null;
}

/** Same-number spacing, on top of the global interval. */
export function phoneReady(now: number, lastSentToPhoneAt: number | null, p: QueuePolicy): boolean {
  return lastSentToPhoneAt === null || now - lastSentToPhoneAt >= p.perPhoneIntervalMs;
}

/**
 * Exponential backoff with full jitter. Jitter matters here: without it, a
 * batch that fails together retries together and recreates the burst.
 */
export function backoffMs(attempts: number, p: QueuePolicy, random: () => number = Math.random): number {
  const exponent = Math.max(0, attempts - 1);
  const ceiling = Math.min(p.backoffBaseMs * 2 ** exponent, p.backoffMaxMs);
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

export interface FailureOutcome {
  status: 'PENDING' | 'FAILED';
  nextAttemptAt: Date;
}

/**
 * What to do with an entry the gateway rejected. A non-retryable rejection
 * (a malformed number, say) is dead on arrival — retrying it only spends
 * reputation on a message that can never be delivered.
 */
export function onFailure(
  attempts: number,
  retryable: boolean,
  p: QueuePolicy,
  now: number = Date.now(),
  random: () => number = Math.random,
): FailureOutcome {
  if (!retryable || attempts >= p.maxAttempts) return { status: 'FAILED', nextAttemptAt: new Date(now) };
  return { status: 'PENDING', nextAttemptAt: new Date(now + backoffMs(attempts, p, random)) };
}
