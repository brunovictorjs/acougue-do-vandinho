import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import type { PricedProduct } from '../domain/order.js';

/** Anti-corruption layer: translates catalog read models into what the Order aggregate needs. */
@Injectable()
export class PricingAdapter {
  constructor(private readonly catalog: CatalogQueryService) {}

  async many(ids: string[]): Promise<Map<string, PricedProduct & { slug: string; coverUrl: string | null }>> {
    const map = await this.catalog.priced([...new Set(ids)]);
    const out = new Map<string, PricedProduct & { slug: string; coverUrl: string | null }>();
    for (const [id, c] of map) {
      out.set(id, {
        id,
        slug: c.slug,
        coverUrl: c.coverUrl,
        name: c.name,
        unit: c.unit,
        listPriceCents: c.listPriceCents,
        priceCents: c.priceCents,
        minQuantity: c.minQuantity,
        quantityStep: c.quantityStep,
        cutOptions: c.cutOptions,
        available: c.available,
        published: c.published,
      });
    }
    return out;
  }

  async one(id: string) {
    const p = (await this.many([id])).get(id);
    if (!p) throw new NotFoundError('Produto');
    return p;
  }
}
