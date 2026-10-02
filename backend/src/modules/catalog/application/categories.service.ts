import { Injectable } from '@nestjs/common';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import { slugify } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, position: c.position, productCount: c._count.products }));
  }

  async save(name: string, id?: string) {
    const clean = name.trim();
    if (!clean) throw new BusinessRuleError('Informe o nome da categoria.');
    const slug = slugify(clean);
    const clash = await this.prisma.category.findUnique({ where: { slug } });
    if (clash && clash.id !== id) throw new ConflictError('Essa categoria já existe.');
    if (id) {
      const found = await this.prisma.category.findUnique({ where: { id } });
      if (!found) throw new NotFoundError('Categoria');
      return this.prisma.category.update({ where: { id }, data: { name: clean, slug } });
    }
    const last = await this.prisma.category.aggregate({ _max: { position: true } });
    return this.prisma.category.create({ data: { name: clean, slug, position: (last._max.position ?? -1) + 1 } });
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(ids.map((id, position) => this.prisma.category.update({ where: { id }, data: { position } })));
    return this.list();
  }

  async remove(id: string) {
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) throw new BusinessRuleError('Mova os produtos desta categoria antes de excluí-la.');
    await this.prisma.category.delete({ where: { id } }).catch(() => {
      throw new NotFoundError('Categoria');
    });
    return { ok: true };
  }
}
