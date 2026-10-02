import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { pageArgs, paged } from '../../../shared/application/pagination.js';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import { parseJson, slugify } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { FileStorage } from '../../../shared/infrastructure/storage/file-storage.js';
import { bestPrice } from '../domain/pricing.js';

export interface ProductInput {
  name: string;
  slug?: string;
  categoryId: string;
  unit: 'KG' | 'UNIT' | 'PACK';
  priceCents: number;
  shortDescription: string;
  description: string;
  published: boolean;
  available: boolean;
  isNew: boolean;
  newUntil?: string | null;
  cutOptions: string[];
  minQuantity: number;
  quantityStep: number;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

@Injectable()
export class ProductsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly config: AppConfig,
  ) {}

  async list(params: { search?: string; categoryId?: string; page?: number }) {
    const pg = pageArgs(params.page);
    const where = { ...(params.categoryId ? { categoryId: params.categoryId } : {}), ...(params.search ? { name: { contains: params.search } } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, media: { orderBy: { position: 'asc' }, take: 1 }, offers: { include: { offer: true } } },
        orderBy: [{ category: { position: 'asc' } }, { name: 'asc' }],
        skip: pg.skip,
        take: pg.take,
      }),
      this.prisma.product.count({ where }),
    ]);
    const now = new Date();
    const items = rows.map((p) => {
      const price = bestPrice(
        p.priceCents,
        p.offers.map((o) => o.offer),
        now,
      );
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category.name,
        categoryId: p.categoryId,
        unit: p.unit,
        priceCents: p.priceCents,
        effectivePriceCents: price.priceCents,
        offerPercent: price.discountPercent,
        published: p.published,
        available: p.available,
        isNew: p.isNew,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        coverUrl: p.media[0]?.url ?? null,
      };
    });
    return paged(items, total, pg);
  }

  /** Every product with minimal fields, for pickers such as choosing the products of an offer. */
  async options() {
    const now = new Date();
    const rows = await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        priceCents: true,
        category: { select: { name: true } },
        // current offers (switched on and not ended): a product may belong to only one
        offers: { where: { offer: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } }, select: { offerId: true } },
      },
      orderBy: [{ category: { position: 'asc' } }, { name: 'asc' }],
    });
    return rows.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, category: p.category.name, currentOfferIds: p.offers.map((o) => o.offerId) }));
  }

  async get(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: { media: { orderBy: { position: 'asc' } }, offers: { include: { offer: true } } } });
    if (!p) throw new NotFoundError('Produto');
    const price = bestPrice(
      p.priceCents,
      p.offers.map((o) => o.offer),
    );
    return {
      ...p,
      cutOptions: parseJson<string[]>(p.cutOptions, []),
      activeOffer: price.offer ? { ...price.offer, priceCents: price.priceCents, discountPercent: price.discountPercent } : null,
      offers: undefined,
    };
  }

  private async validate(input: ProductInput, id?: string) {
    const name = input.name.trim();
    if (!name) throw new BusinessRuleError('Informe o nome do produto.');
    if (input.priceCents <= 0) throw new BusinessRuleError('Informe um preço maior que zero.');
    if (input.minQuantity <= 0 || input.quantityStep <= 0) throw new BusinessRuleError('Quantidade mínima e incremento devem ser maiores que zero.');
    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new BusinessRuleError('Categoria inválida.');
    const slug = slugify(input.slug?.trim() || name);
    const clash = await this.prisma.product.findUnique({ where: { slug } });
    if (clash && clash.id !== id) throw new ConflictError('Já existe um produto com esse endereço (slug).');
    const cutOptions = [...new Set(input.cutOptions.map((c) => c.trim()).filter(Boolean))];
    return {
      name,
      slug,
      categoryId: input.categoryId,
      unit: input.unit,
      priceCents: Math.round(input.priceCents),
      shortDescription: input.shortDescription.trim(),
      description: input.description,
      published: input.published,
      available: input.available,
      isNew: input.isNew,
      newUntil: input.isNew && input.newUntil ? new Date(input.newUntil) : null,
      cutOptions: JSON.stringify(cutOptions),
      minQuantity: input.minQuantity,
      quantityStep: input.quantityStep,
    };
  }

  async create(input: ProductInput) {
    const data = await this.validate(input);
    const p = await this.prisma.product.create({ data });
    return this.get(p.id);
  }

  async update(id: string, input: ProductInput) {
    await this.ensure(id);
    const data = await this.validate(input, id);
    await this.prisma.product.update({ where: { id }, data });
    return this.get(id);
  }

  async patchFlags(id: string, flags: { published?: boolean; available?: boolean; isNew?: boolean }) {
    await this.ensure(id);
    await this.prisma.product.update({ where: { id }, data: flags });
    return { ok: true };
  }

  async remove(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: { media: true } });
    if (!p) throw new NotFoundError('Produto');
    const sold = await this.prisma.orderItem.count({ where: { productId: id } });
    if (sold > 0) {
      // Keep history intact: products that were ever ordered are only unpublished.
      await this.prisma.product.update({ where: { id }, data: { published: false, available: false } });
      return { ok: true, archived: true };
    }
    await this.prisma.product.delete({ where: { id } });
    await Promise.all(p.media.map((m) => this.storage.remove(m.url)));
    return { ok: true, archived: false };
  }

  async addMedia(productId: string, file: { buffer: Buffer; mimetype: string; size: number; originalname: string }, alt = '') {
    await this.ensure(productId);
    const isImage = IMAGE_TYPES.includes(file.mimetype);
    const isVideo = VIDEO_TYPES.includes(file.mimetype);
    if (!isImage && !isVideo) throw new BusinessRuleError('Envie JPG, PNG, WEBP, MP4 ou WEBM.');
    if (isImage && file.size > this.config.uploads.maxImageBytes) throw new BusinessRuleError('Imagens devem ter até 5 MB.');
    if (isVideo && file.size > this.config.uploads.maxVideoBytes) throw new BusinessRuleError('Vídeos devem ter até 50 MB.');
    const stored = await this.storage.save('products', file.originalname, file.buffer, file.mimetype);
    const last = await this.prisma.productMedia.aggregate({ where: { productId }, _max: { position: true } });
    return this.prisma.productMedia.create({ data: { productId, url: stored.url, type: isImage ? 'IMAGE' : 'VIDEO', alt, position: (last._max.position ?? -1) + 1 } });
  }

  async reorderMedia(productId: string, ids: string[]) {
    await this.prisma.$transaction(ids.map((id, position) => this.prisma.productMedia.updateMany({ where: { id, productId }, data: { position } })));
    return this.get(productId);
  }

  async removeMedia(productId: string, mediaId: string) {
    const m = await this.prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!m) throw new NotFoundError('Mídia');
    await this.prisma.productMedia.delete({ where: { id: mediaId } });
    await this.storage.remove(m.url);
    return { ok: true };
  }

  /** Called by the reviews context whenever published reviews change. */
  async refreshRating(productId: string) {
    const agg = await this.prisma.review.aggregate({ where: { productId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } });
    await this.prisma.product.update({ where: { id: productId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
  }

  /** Called when an order is paid, feeds the "mais vendidos" ordering. */
  async addSold(items: Array<{ productId: string; quantity: number }>) {
    for (const i of items) {
      await this.prisma.product.updateMany({ where: { id: i.productId }, data: { soldCount: { increment: i.quantity } } });
    }
  }

  private async ensure(id: string) {
    const found = await this.prisma.product.findUnique({ where: { id } });
    if (!found) throw new NotFoundError('Produto');
  }
}
