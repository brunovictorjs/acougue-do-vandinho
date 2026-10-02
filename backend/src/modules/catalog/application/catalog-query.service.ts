import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { normalizeName, parseJson } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { bestPrice, isOfferLive, OfferRule } from '../domain/pricing.js';

const cardInclude = {
  category: true,
  media: { orderBy: { position: 'asc' } },
  offers: { include: { offer: true } },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  category: { id: string; name: string; slug: string };
  unit: 'KG' | 'UNIT' | 'PACK';
  shortDescription: string;
  listPriceCents: number;
  priceCents: number;
  offer: null | { id: string; name: string; showBadge: boolean; discountPercent: number; endsAt: Date | null };
  ratingAvg: number;
  ratingCount: number;
  isNew: boolean;
  available: boolean;
  coverUrl: string | null;
  minQuantity: number;
  quantityStep: number;
  cutOptions: string[];
}

export interface ProductDetail extends ProductCard {
  description: string;
  media: Array<{ id: string; type: 'IMAGE' | 'VIDEO'; url: string; alt: string }>;
}

export type ProductSort = 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'newest';

/** Read side of the catalog, shared with ordering (prices) and the assistant (search). */
@Injectable()
export class CatalogQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private toCard(p: ProductWithRelations, now = new Date()): ProductCard {
    const offers: OfferRule[] = p.offers.map((o) => o.offer);
    const price = bestPrice(p.priceCents, offers, now);
    const cover = p.media.find((m) => m.type === 'IMAGE') ?? null;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: { id: p.category.id, name: p.category.name, slug: p.category.slug },
      unit: p.unit,
      shortDescription: p.shortDescription,
      listPriceCents: p.priceCents,
      priceCents: price.priceCents,
      offer: price.offer
        ? { id: price.offer.id, name: price.offer.name, showBadge: price.offer.showBadge, discountPercent: price.discountPercent, endsAt: price.offer.endsAt }
        : null,
      ratingAvg: Math.round(p.ratingAvg * 10) / 10,
      ratingCount: p.ratingCount,
      isNew: p.isNew && (!p.newUntil || p.newUntil > now),
      available: p.available,
      coverUrl: cover?.url ?? null,
      minQuantity: p.minQuantity,
      quantityStep: p.quantityStep,
      cutOptions: parseJson<string[]>(p.cutOptions, []),
    };
  }

  async categories() {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: { published: true } } } } },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c._count.products }));
  }

  private async published() {
    const rows = await this.prisma.product.findMany({ where: { published: true }, include: cardInclude });
    const now = new Date();
    return rows.map((r) => ({ row: r, card: this.toCard(r, now) }));
  }

  /** Landing page data: featured offers, "chegou no balcão" and categories. */
  async home() {
    const all = await this.published();
    const now = new Date();
    const offers = all
      .filter(({ row, card }) => card.offer && card.available && row.offers.some((o) => o.offer.featured && isOfferLive(o.offer, now)))
      .map(({ card }) => card)
      .sort((a, b) => (b.offer?.discountPercent ?? 0) - (a.offer?.discountPercent ?? 0));
    const novidades = all
      .filter(({ card }) => card.isNew)
      .sort((a, b) => b.row.createdAt.getTime() - a.row.createdAt.getTime())
      .map(({ card }) => card)
      .slice(0, 6);
    return { offers, novidades, categories: await this.categories() };
  }

  async list(params: { category?: string; search?: string; sort?: ProductSort; offersOnly?: boolean; page?: number; pageSize?: number }) {
    const all = await this.published();
    const q = params.search ? normalizeName(params.search) : '';
    let items = all.filter(({ row, card }) => {
      if (params.category && card.category.slug !== params.category) return false;
      if (params.offersOnly && !card.offer) return false;
      if (q && !normalizeName(`${row.name} ${row.category.name} ${row.shortDescription}`).includes(q)) return false;
      return true;
    });
    const sort = params.sort ?? 'popular';
    items = items.sort((a, b) => {
      // Unavailable products always go last.
      if (a.card.available !== b.card.available) return a.card.available ? -1 : 1;
      switch (sort) {
        case 'price_asc':
          return a.card.priceCents - b.card.priceCents;
        case 'price_desc':
          return b.card.priceCents - a.card.priceCents;
        case 'rating':
          return b.card.ratingAvg - a.card.ratingAvg || b.card.ratingCount - a.card.ratingCount;
        case 'newest':
          return b.row.createdAt.getTime() - a.row.createdAt.getTime();
        default:
          return b.row.soldCount - a.row.soldCount || a.card.name.localeCompare(b.card.name);
      }
    });
    const pageSize = Math.min(params.pageSize ?? 12, 48);
    const page = Math.max(params.page ?? 1, 1);
    return {
      total: items.length,
      page,
      pageSize,
      items: items.slice((page - 1) * pageSize, page * pageSize).map((i) => i.card),
    };
  }

  async bySlug(slug: string): Promise<ProductDetail> {
    const p = await this.prisma.product.findUnique({ where: { slug }, include: cardInclude });
    if (!p || !p.published) throw new NotFoundError('Produto');
    return {
      ...this.toCard(p),
      description: p.description,
      media: p.media.map((m) => ({ id: m.id, type: m.type, url: m.url, alt: m.alt })),
    };
  }

  /** Current prices for the given products (published or not — ordering decides). */
  async priced(ids: string[]) {
    const rows = await this.prisma.product.findMany({ where: { id: { in: ids } }, include: cardInclude });
    const now = new Date();
    return new Map(rows.map((r) => [r.id, { ...this.toCard(r, now), published: r.published }]));
  }

  async cards(ids: string[]) {
    const map = await this.priced(ids);
    return ids.map((id) => map.get(id)).filter((c): c is NonNullable<typeof c> => !!c && c.published);
  }

  async related(productId: string, limit = 4) {
    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p) return [];
    const all = await this.published();
    return all
      .filter(({ row, card }) => row.id !== productId && card.available && row.categoryId !== p.categoryId)
      .sort((a, b) => b.row.soldCount - a.row.soldCount)
      .slice(0, limit)
      .map(({ card }) => card);
  }
}
