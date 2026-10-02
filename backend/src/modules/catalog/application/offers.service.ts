import { Injectable } from '@nestjs/common';
import { pageArgs, paged } from '../../../shared/application/pagination.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/domain/errors.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { DiscountKind, isOfferLive, validateOffer } from '../domain/pricing.js';

export interface OfferInput {
  name: string;
  discountType: DiscountKind;
  value: number;
  startsAt: string;
  endsAt?: string | null;
  active: boolean;
  showBadge: boolean;
  featured: boolean;
  productIds: string[];
}

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page?: number) {
    const p = pageArgs(page);
    const [rows, total] = await Promise.all([
      this.prisma.offer.findMany({
        orderBy: { startsAt: 'desc' },
        include: { products: { include: { product: { select: { id: true, name: true, priceCents: true } } } } },
        skip: p.skip,
        take: p.take,
      }),
      this.prisma.offer.count(),
    ]);
    const now = new Date();
    const items = rows.map((o) => ({
      ...o,
      products: o.products.map((p) => p.product),
      status: !o.active ? 'INACTIVE' : o.startsAt > now ? 'SCHEDULED' : o.endsAt && o.endsAt <= now ? 'ENDED' : 'LIVE',
      live: isOfferLive(o, now),
    }));
    return paged(items, total, p);
  }

  private parse(input: OfferInput) {
    const name = input.name.trim();
    if (!name) throw new BusinessRuleError('Dê um nome para a oferta.');
    if (!input.productIds.length) throw new BusinessRuleError('Escolha ao menos um produto.');
    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new BusinessRuleError('Datas inválidas.');
    const data = { name, discountType: input.discountType, value: Math.round(input.value), startsAt, endsAt, active: input.active, showBadge: input.showBadge, featured: input.featured };
    validateOffer(data);
    return data;
  }

  /**
   * A product belongs to at most one current offer — one that is switched on
   * and has not ended (live or scheduled). Ended or switched-off offers don't count.
   */
  private async ensureNoOverlap(productIds: string[], offer: { active: boolean; endsAt: Date | null }, exceptOfferId?: string) {
    const now = new Date();
    if (!offer.active || (offer.endsAt && offer.endsAt <= now)) return;
    const taken = await this.prisma.offerProduct.findMany({
      where: {
        productId: { in: productIds },
        ...(exceptOfferId ? { offerId: { not: exceptOfferId } } : {}),
        offer: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      },
      include: { product: { select: { name: true } }, offer: { select: { name: true } } },
    });
    if (taken.length) {
      const list = taken.map((t) => `${t.product.name} (em “${t.offer.name}”)`).join(', ');
      throw new BusinessRuleError(`Estes produtos já estão em outra oferta vigente: ${list}.`);
    }
  }

  async create(input: OfferInput) {
    const data = this.parse(input);
    await this.ensureNoOverlap(input.productIds, data);
    const offer = await this.prisma.offer.create({
      data: { ...data, products: { create: [...new Set(input.productIds)].map((productId) => ({ productId })) } },
    });
    return offer;
  }

  async update(id: string, input: OfferInput) {
    const data = this.parse(input);
    await this.ensure(id);
    await this.ensureNoOverlap(input.productIds, data, id);
    await this.prisma.$transaction([
      this.prisma.offerProduct.deleteMany({ where: { offerId: id } }),
      this.prisma.offer.update({
        where: { id },
        data: { ...data, products: { create: [...new Set(input.productIds)].map((productId) => ({ productId })) } },
      }),
    ]);
    return { ok: true };
  }

  async setActive(id: string, active: boolean) {
    const offer = await this.ensure(id);
    if (active) {
      const products = await this.prisma.offerProduct.findMany({ where: { offerId: id }, select: { productId: true } });
      await this.ensureNoOverlap(products.map((p) => p.productId), { active, endsAt: offer.endsAt }, id);
    }
    await this.prisma.offer.update({ where: { id }, data: { active } });
    return { ok: true };
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.offer.delete({ where: { id } });
    return { ok: true };
  }

  private async ensure(id: string) {
    const found = await this.prisma.offer.findUnique({ where: { id } });
    if (!found) throw new NotFoundError('Oferta');
    return found;
  }
}
