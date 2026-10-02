import { BusinessRuleError } from './errors.js';

// Admin filters send calendar days ("2026-10-01"). `new Date("2026-10-01")` is
// UTC midnight, which in Brazil is still the previous day — so days are parsed
// in the server's local time zone instead.

function localDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 00:00:00.000 of the given day, local time. */
export function startOfDay(iso: string): Date | null {
  const d = localDay(iso);
  d?.setHours(0, 0, 0, 0);
  return d;
}

/** 23:59:59.999 of the given day, local time. */
export function endOfDay(iso: string): Date | null {
  const d = localDay(iso);
  d?.setHours(23, 59, 59, 999);
  return d;
}

/** Prisma `DateTime` filter for an inclusive day range; undefined when neither end is set. */
export function dayRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const gte = from ? startOfDay(from) : null;
  const lte = to ? endOfDay(to) : null;
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

/**
 * Inclusive report period from optional calendar days. Missing ends default to
 * "today" and "the 1st of that month", so an unfiltered report shows the month so far.
 */
export function periodRange(fromIso?: string, toIso?: string): { from: Date; to: Date } {
  const to = (toIso && endOfDay(toIso)) || new Date(new Date().setHours(23, 59, 59, 999));
  const from = (fromIso && startOfDay(fromIso)) || new Date(to.getFullYear(), to.getMonth(), 1);
  if (from > to) throw new BusinessRuleError('A data inicial deve ser anterior à data final.');
  return { from, to };
}

/** "YYYY-MM-DD" of a date in local time. */
export function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
