/** Lowercase, strip accents and collapse whitespace — used to match neighborhoods. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(value: string): string {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatQuantity(quantity: number, unit: 'KG' | 'UNIT' | 'PACK'): string {
  if (unit === 'KG') return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`;
  const n = quantity.toLocaleString('pt-BR');
  return unit === 'PACK' ? `${n} pct` : `${n} un`;
}

/** Keeps digits only and assumes Brazil (55) when the country code is missing. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 13) return null;
  return digits;
}

export function formatPhone(digits: string): string {
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits;
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
