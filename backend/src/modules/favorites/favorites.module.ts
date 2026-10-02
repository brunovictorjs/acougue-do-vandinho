import { Controller, Delete, Get, Injectable, Module, Param, Put } from '@nestjs/common';
import { NotFoundError } from '../../shared/domain/errors.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { CurrentUser } from '../../shared/presentation/auth.js';
import type { AuthUser } from '../../shared/presentation/auth.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CatalogQueryService } from '../catalog/application/catalog-query.service.js';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
  ) {}

  async ids(userId: string) {
    const rows = await this.prisma.favorite.findMany({ where: { userId }, select: { productId: true } });
    return rows.map((r) => r.productId);
  }

  async list(userId: string) {
    const rows = await this.prisma.favorite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return this.catalog.cards(rows.map((r) => r.productId));
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Produto');
    await this.prisma.favorite.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return { favorite: true };
  }

  async remove(userId: string, productId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
    return { favorite: false };
  }
}

@Controller('me/favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.favorites.list(user.id);
  }

  @Get('ids')
  ids(@CurrentUser() user: AuthUser) {
    return this.favorites.ids(user.id);
  }

  @Put(':productId')
  add(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.favorites.add(user.id, productId);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.favorites.remove(user.id, productId);
  }
}

/** Small context: a customer's saved products. */
@Module({
  imports: [CatalogModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
