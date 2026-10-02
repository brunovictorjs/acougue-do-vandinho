import { BusinessRuleError } from '../../../shared/domain/errors.js';

export type DiscountKind = 'PERCENT' | 'AMOUNT' | 'FIXED_PRICE';

export interface OfferRule {
  id: string;
  name: string;
  discountType: DiscountKind;
  /** percent (0–100) for PERCENT, cents otherwise */
  value: number;
  startsAt: Date;
  endsAt: Date | null;
  active: boolean;
  showBadge: boolean;
  featured: boolean;
}

export interface PriceResult {
  listPriceCents: number;
  priceCents: number;
  offer: OfferRule | null;
  discountPercent: number;
}

export function isOfferLive(offer: OfferRule, now = new Date()): boolean {
  return offer.active && offer.startsAt <= now && (!offer.endsAt || offer.endsAt > now);
}

export function discountedPrice(listPriceCents: number, offer: OfferRule): number {
  let price: number;
  switch (offer.discountType) {
    case 'PERCENT':
      price = Math.round(listPriceCents * (1 - Math.min(Math.max(offer.value, 0), 100) / 100));
      break;
    case 'AMOUNT':
      price = listPriceCents - offer.value;
      break;
    case 'FIXED_PRICE':
      price = offer.value;
      break;
  }
  return Math.max(0, Math.min(price, listPriceCents));
}

/** The customer always gets the best live offer for the product. */
export function bestPrice(listPriceCents: number, offers: OfferRule[], now = new Date()): PriceResult {
  let best: PriceResult = { listPriceCents, priceCents: listPriceCents, offer: null, discountPercent: 0 };
  for (const offer of offers) {
    if (!isOfferLive(offer, now)) continue;
    const priceCents = discountedPrice(listPriceCents, offer);
    if (priceCents < best.priceCents) {
      best = {
        listPriceCents,
        priceCents,
        offer,
        discountPercent: Math.round((1 - priceCents / listPriceCents) * 100),
      };
    }
  }
  return best;
}

export function validateOffer(input: Pick<OfferRule, 'discountType' | 'value' | 'startsAt' | 'endsAt'>) {
  if (input.discountType === 'PERCENT' && (input.value <= 0 || input.value >= 100)) {
    throw new BusinessRuleError('O percentual deve ficar entre 1 e 99.');
  }
  if (input.discountType !== 'PERCENT' && input.value <= 0) {
    throw new BusinessRuleError('Informe um valor maior que zero.');
  }
  if (input.endsAt && input.endsAt <= input.startsAt) {
    throw new BusinessRuleError('O fim da oferta precisa ser depois do início.');
  }
}

/** Quantities are sold in steps (e.g. 0,5 kg) starting at a minimum. */
export function validateQuantity(quantity: number, rule: { minQuantity: number; quantityStep: number; unit: string }) {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new BusinessRuleError('Quantidade inválida.');
  if (quantity < rule.minQuantity - 1e-9) {
    throw new BusinessRuleError(`A quantidade mínima é ${rule.minQuantity.toLocaleString('pt-BR')}.`);
  }
  if (quantity > 50) throw new BusinessRuleError('Para quantidades acima de 50, fale com a loja.');
  const steps = (quantity - rule.minQuantity) / rule.quantityStep;
  if (Math.abs(steps - Math.round(steps)) > 1e-6) {
    throw new BusinessRuleError(`A quantidade deve variar de ${rule.quantityStep.toLocaleString('pt-BR')} em ${rule.quantityStep.toLocaleString('pt-BR')}.`);
  }
}

export function lineTotal(unitPriceCents: number, quantity: number): number {
  return Math.round(unitPriceCents * quantity);
}
