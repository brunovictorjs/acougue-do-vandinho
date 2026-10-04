import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { pageArgs, paged } from '../../../shared/application/pagination.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/domain/errors.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import type { RoleName } from '../../../shared/presentation/auth.js';

export interface UserContact {
  id: string;
  fullName: string;
  firstName: string;
  email: string;
  phone: string | null;
  role: RoleName;
}

/**
 * Read-side facade other contexts use to resolve people (who to notify, who
 * is writing on WhatsApp, courier names). Also hosts the admin role changes.
 */
@Injectable()
export class UserDirectory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  private toContact(u: { id: string; firstName: string; lastName: string; email: string; phone: string | null; role: RoleName }): UserContact {
    return { id: u.id, firstName: u.firstName, fullName: `${u.firstName} ${u.lastName}`.trim(), email: u.email, phone: u.phone, role: u.role };
  }

  async contact(userId: string): Promise<UserContact | null> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    return u ? this.toContact(u) : null;
  }

  /**
   * Para onde vão os avisos da administração: o e-mail de cada usuário ADMIN
   * mais os de ADMIN_EMAILS (o dono recebe antes do primeiro login).
   */
  async adminEmails(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
    const emails = [...rows.map((r) => r.email), ...this.config.adminEmails];
    return [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
  }

  /** Only verified numbers identify a customer on WhatsApp. */
  async findByVerifiedPhone(phone: string): Promise<UserContact | null> {
    const u = await this.prisma.user.findFirst({ where: { phone, phoneVerifiedAt: { not: null } } });
    return u ? this.toContact(u) : null;
  }

  async list(params: { role?: RoleName; search?: string; page?: number }) {
    const search = params.search?.trim();
    const p = pageArgs(params.page);
    const where = {
      ...(params.role ? { role: params.role } : {}),
      ...(search
        ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { email: { contains: search } }, { phone: { contains: search.replace(/\D/g, '') || search } }] }
        : {}),
    };
    const [users, total, counts] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { orders: { where: { status: 'PAID' } }, addresses: true } } }, skip: p.skip, take: p.take }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    ]);
    return {
      counts: Object.fromEntries(counts.map((c) => [c.role, c._count._all])) as Partial<Record<RoleName, number>>,
      ...paged(
        users.map((u) => ({
          id: u.id,
          fullName: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          phone: u.phone,
          phoneVerified: !!u.phoneVerifiedAt,
          avatarUrl: u.avatarUrl,
          role: u.role,
          paidOrders: u._count.orders,
          onboardingComplete: u.role !== 'CUSTOMER' || (!!u.phoneVerifiedAt && u._count.addresses > 0),
          createdAt: u.createdAt,
        })),
        total,
        p,
      ),
    };
  }

  async changeRole(actorId: string, userId: string, role: RoleName) {
    if (actorId === userId && role !== 'ADMIN') {
      throw new BusinessRuleError('Você não pode remover o seu próprio acesso de administrador.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Usuário');
    if (user.role === 'ADMIN' && role !== 'ADMIN') {
      const admins = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) throw new BusinessRuleError('A loja precisa de pelo menos um administrador.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { role } });
    return { id: userId, role };
  }
}
