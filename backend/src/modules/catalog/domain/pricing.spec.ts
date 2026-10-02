import { bestPrice, discountedPrice, lineTotal, OfferRule, validateQuantity } from './pricing.js';

const offer = (over: Partial<OfferRule>): OfferRule => ({
  id: 'o1',
  name: 'Oferta',
  discountType: 'PERCENT',
  value: 10,
  startsAt: new Date('2026-01-01'),
  endsAt: null,
  active: true,
  showBadge: true,
  featured: false,
  ...over,
});

describe('pricing', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  it('applies percent, amount and fixed-price discounts without going below zero', () => {
    expect(discountedPrice(10490, offer({ value: 14 }))).toBe(9021);
    expect(discountedPrice(10490, offer({ discountType: 'AMOUNT', value: 1500 }))).toBe(8990);
    expect(discountedPrice(10490, offer({ discountType: 'FIXED_PRICE', value: 8990 }))).toBe(8990);
    expect(discountedPrice(500, offer({ discountType: 'AMOUNT', value: 900 }))).toBe(0);
    expect(discountedPrice(500, offer({ discountType: 'FIXED_PRICE', value: 900 }))).toBe(500);
  });

  it('picks the best live offer and ignores expired or inactive ones', () => {
    const offers = [
      offer({ id: 'a', value: 10 }),
      offer({ id: 'b', value: 30, endsAt: new Date('2026-09-01') }),
      offer({ id: 'c', value: 40, active: false }),
      offer({ id: 'd', discountType: 'FIXED_PRICE', value: 8990 }),
    ];
    const r = bestPrice(10490, offers, now);
    expect(r.offer?.id).toBe('d');
    expect(r.priceCents).toBe(8990);
    expect(r.discountPercent).toBe(14);
  });

  it('returns list price when there is no offer', () => {
    expect(bestPrice(5290, [], now)).toMatchObject({ priceCents: 5290, offer: null, discountPercent: 0 });
  });

  it('validates weight steps', () => {
    const rule = { minQuantity: 0.5, quantityStep: 0.5, unit: 'KG' };
    expect(() => validateQuantity(1.5, rule)).not.toThrow();
    expect(() => validateQuantity(0.25, rule)).toThrow(/mínima/);
    expect(() => validateQuantity(1.2, rule)).toThrow(/variar/);
  });

  it('rounds line totals to cents', () => {
    expect(lineTotal(8990, 1.5)).toBe(13485);
  });
});
