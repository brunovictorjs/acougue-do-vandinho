import { describe, expect, it } from 'vitest';
import { backoffMs, globalBlock, onFailure, phoneReady, QueuePolicy } from './outbox-policy.js';

const policy: QueuePolicy = {
  minIntervalMs: 4000,
  perPhoneIntervalMs: 15000,
  perMinuteLimit: 12,
  maxAttempts: 5,
  backoffBaseMs: 30000,
  backoffMaxMs: 1800000,
};

describe('globalBlock', () => {
  it('lets the first message through', () => {
    expect(globalBlock({ now: 1000, lastSentAt: null, sentLastMinute: 0 }, policy)).toBeNull();
  });

  it('holds a message that would follow the previous one too closely', () => {
    expect(globalBlock({ now: 10_000, lastSentAt: 7000, sentLastMinute: 1 }, policy)).toBe('interval');
  });

  it('releases once the interval has elapsed', () => {
    expect(globalBlock({ now: 11_000, lastSentAt: 7000, sentLastMinute: 1 }, policy)).toBeNull();
  });

  it('holds everything once the per-minute cap is reached', () => {
    expect(globalBlock({ now: 1_000_000, lastSentAt: 1, sentLastMinute: 12 }, policy)).toBe('per-minute');
  });

  it('reports the per-minute cap ahead of the interval', () => {
    expect(globalBlock({ now: 10_000, lastSentAt: 9_900, sentLastMinute: 20 }, policy)).toBe('per-minute');
  });
});

describe('phoneReady', () => {
  it('allows a number we never messaged', () => {
    expect(phoneReady(5000, null, policy)).toBe(true);
  });

  it('keeps a number cooling down', () => {
    expect(phoneReady(10_000, 2000, policy)).toBe(false);
  });

  it('allows it again after the per-number interval', () => {
    expect(phoneReady(20_000, 2000, policy)).toBe(true);
  });
});

describe('backoffMs', () => {
  it('grows exponentially from the base', () => {
    const mid = () => 0.5;
    expect(backoffMs(1, policy, mid)).toBe(22_500); // around 30s
    expect(backoffMs(2, policy, mid)).toBe(45_000); // around 60s
    expect(backoffMs(3, policy, mid)).toBe(90_000); // around 120s
  });

  it('never exceeds the ceiling', () => {
    expect(backoffMs(30, policy, () => 1)).toBe(policy.backoffMaxMs);
  });

  it('jitters within the top half of the window', () => {
    expect(backoffMs(1, policy, () => 0)).toBe(15_000);
    expect(backoffMs(1, policy, () => 1)).toBe(30_000);
  });
});

describe('onFailure', () => {
  it('schedules a retry while attempts remain', () => {
    const out = onFailure(1, true, policy, 0, () => 0.5);
    expect(out.status).toBe('PENDING');
    expect(out.nextAttemptAt.getTime()).toBe(22_500);
  });

  it('gives up once maxAttempts is reached', () => {
    expect(onFailure(5, true, policy, 0).status).toBe('FAILED');
  });

  it('gives up immediately on a non-retryable rejection', () => {
    expect(onFailure(1, false, policy, 0).status).toBe('FAILED');
  });
});
