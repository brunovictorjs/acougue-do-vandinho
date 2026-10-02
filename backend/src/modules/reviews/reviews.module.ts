import { Body, Controller, Get, Injectable, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PageQuery, pageArgs, paged } from '../../shared/application/pagination.js';
import { dayRange } from '../../shared/domain/dates.js';
import { BusinessRuleError, NotFoundError } from '../../shared/domain/errors.js';
import { parseJson } from '../../shared/domain/text.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { CurrentUser, OptionalUser, Public, Roles } from '../../shared/presentation/auth.js';
import type { AuthUser } from '../../shared/presentation/auth.js';
import { ProductsAdminService } from '../catalog/application/products-admin.service.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { OrdersService } from '../ordering/application/orders.service.js';
import { OrderingModule } from '../ordering/ordering.module.js';

export const REVIEW_TAGS = ['Macia', 'Corte certo', 'Bem embalada', 'Chegou gelada', 'Suculenta', 'Bom tempero'];

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly products: ProductsAdminService,
  ) {}

  async forProduct(productId: string, params: { filter?: 'all' | 'photos' | 'five' | 'critical'; page?: number }, viewerId: string | null) {
    const where = { productId, status: 'PUBLISHED' as const, ...(params.filter === 'five' ? { rating: 5 } : {}), ...(params.filter === 'critical' ? { rating: { lte: 3 } } : {}) };
    const pageSize = 10;
    const page = Math.max(params.page ?? 1, 1);
    const [rows, total, distribution, mine, canReview] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({ by: ['rating'], where: { productId, status: 'PUBLISHED' }, _count: { _all: true } }),
      viewerId ? this.prisma.review.findUnique({ where: { productId_userId: { productId, userId: viewerId } } }) : null,
      viewerId ? this.orders.hasReceived(viewerId, productId) : false,
    ]);
    return {
      total,
      page,
      pageSize,
      distribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: distribution.find((d) => d.rating === r)?._count._all ?? 0 })),
      canReview,
      mine: mine ? { rating: mine.rating, comment: mine.comment, tags: parseJson<string[]>(mine.tags, []) } : null,
      tags: REVIEW_TAGS,
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        tags: parseJson<string[]>(r.tags, []),
        author: `${r.user.firstName} ${r.user.lastName.charAt(0)}${r.user.lastName ? '.' : ''}`.trim(),
        avatarUrl: r.user.avatarUrl,
        reply: r.reply,
        createdAt: r.createdAt,
      })),
    };
  }

  /** One review per customer per product; writing again updates it. */
  async upsert(userId: string, productId: string, input: { rating: number; comment?: string; tags?: string[] }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Produto');
    if (!(await this.orders.hasReceived(userId, productId))) {
      throw new BusinessRuleError('Você pode avaliar depois de receber este produto.', 'review_not_allowed');
    }
    const tags = (input.tags ?? []).filter((t) => REVIEW_TAGS.includes(t));
    const data = { rating: input.rating, comment: input.comment?.trim() || null, tags: JSON.stringify(tags) };
    await this.prisma.review.upsert({ where: { productId_userId: { productId, userId } }, create: { productId, userId, ...data }, update: data });
    await this.products.refreshRating(productId);
    return { ok: true };
  }

  async adminList(params: { status?: 'PUBLISHED' | 'HIDDEN'; rating?: number; critical?: boolean; search?: string; from?: string; to?: string; page?: number }) {
    const createdAt = dayRange(params.from, params.to);
    const p = pageArgs(params.page);
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.rating ? { rating: params.rating } : {}),
      ...(params.critical ? { rating: { lte: 3 } } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(params.search ? { OR: [{ product: { name: { contains: params.search } } }, { user: { firstName: { contains: params.search } } }] } : {}),
    };
    const [rows, total, avg, unanswered, hidden] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { product: { select: { name: true, slug: true } }, user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({ where: { status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } }),
      this.prisma.review.count({ where: { rating: { lte: 3 }, reply: null, status: 'PUBLISHED' } }),
      this.prisma.review.count({ where: { status: 'HIDDEN' } }),
    ]);
    return {
      stats: { average: avg._avg.rating ?? 0, published: avg._count._all, unanswered, hidden },
      ...paged(
        rows.map((r) => ({
          id: r.id,
          product: r.product.name,
          productSlug: r.product.slug,
          customer: `${r.user.firstName} ${r.user.lastName}`.trim(),
          rating: r.rating,
          comment: r.comment,
          tags: parseJson<string[]>(r.tags, []),
          status: r.status,
          reply: r.reply,
          createdAt: r.createdAt,
        })),
        total,
        p,
      ),
    };
  }

  async setStatus(id: string, status: 'PUBLISHED' | 'HIDDEN') {
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw new NotFoundError('Avaliação');
    await this.prisma.review.update({ where: { id }, data: { status } });
    await this.products.refreshRating(r.productId);
    return { ok: true };
  }

  async reply(id: string, reply: string) {
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw new NotFoundError('Avaliação');
    await this.prisma.review.update({ where: { id }, data: { reply: reply.trim() || null, repliedAt: reply.trim() ? new Date() : null } });
    return { ok: true };
  }
}

class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) tags?: string[];
}

class ProductReviewsQuery {
  @IsOptional() @IsIn(['all', 'photos', 'five', 'critical']) filter?: 'all' | 'photos' | 'five' | 'critical';
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page?: number;
}

class AdminReviewsQuery extends PageQuery {
  @IsOptional() @IsIn(['PUBLISHED', 'HIDDEN']) status?: 'PUBLISHED' | 'HIDDEN';
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(5) rating?: number;
  /** Only 1 to 3 star reviews. */
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() critical?: boolean;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

class StatusDto {
  @IsIn(['PUBLISHED', 'HIDDEN']) status!: 'PUBLISHED' | 'HIDDEN';
}

class ReplyDto {
  @IsString() @MaxLength(1000) reply!: string;
}

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('products/:productId/reviews')
  list(@Param('productId') productId: string, @Query() q: ProductReviewsQuery, @OptionalUser() user: AuthUser | null) {
    return this.reviews.forProduct(productId, q, user?.id ?? null);
  }

  @Put('products/:productId/reviews')
  upsert(@CurrentUser() user: AuthUser, @Param('productId') productId: string, @Body() dto: ReviewDto) {
    return this.reviews.upsert(user.id, productId, dto);
  }

  @Roles('EMPLOYEE')
  @Get('admin/reviews')
  adminList(@Query() q: AdminReviewsQuery) {
    return this.reviews.adminList(q);
  }

  @Roles('EMPLOYEE')
  @Patch('admin/reviews/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.reviews.setStatus(id, dto.status);
  }

  @Roles('EMPLOYEE')
  @Post('admin/reviews/:id/reply')
  reply(@Param('id') id: string, @Body() dto: ReplyDto) {
    return this.reviews.reply(id, dto.reply);
  }
}

@Module({ imports: [CatalogModule, OrderingModule], controllers: [ReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
