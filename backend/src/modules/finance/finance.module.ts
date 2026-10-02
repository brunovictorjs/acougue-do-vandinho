import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { localDate, periodRange } from '../../shared/domain/dates.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { Roles } from '../../shared/presentation/auth.js';

/**
 * Reporting read model for the admin dashboard. It reads the ordering,
 * payments and delivery tables directly — reports are a projection, not a
 * place for business rules.
 */
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(fromIso?: string, toIso?: string) {
    const { from, to } = periodRange(fromIso, toIso);
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span - 1);
    const prevTo = new Date(from.getTime() - 1);

    // Revenue = orders that were paid in the period (cancelled later still counted as gross, refunds shown apart).
    const paidWhere = { paidAt: { gte: from, lte: to }, status: { in: ['PAID', 'CANCELLED'] as Array<'PAID' | 'CANCELLED'> } };
    const [paid, prevPaid, refunds, recent, deliveriesByStatus, topItems] = await Promise.all([
      this.prisma.order.findMany({ where: paidWhere, select: { id: true, totalCents: true, deliveryFeeCents: true, paymentMethod: true, paidAt: true } }),
      this.prisma.order.aggregate({ where: { paidAt: { gte: prevFrom, lte: prevTo } }, _sum: { totalCents: true }, _count: { _all: true } }),
      this.prisma.refund.aggregate({ where: { status: 'SUCCEEDED', completedAt: { gte: from, lte: to } }, _sum: { amountCents: true }, _count: { _all: true } }),
      this.prisma.order.findMany({
        where: { OR: [{ status: { not: 'CART' } }, { checkoutAt: { not: null } }] },
        include: { user: { select: { firstName: true, lastName: true } }, delivery: { select: { status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.delivery.groupBy({ by: ['status'], where: { OR: [{ status: { in: ['AWAITING', 'IN_TRANSIT', 'NOT_DELIVERED'] } }, { status: 'DELIVERED', deliveredAt: { gte: startOfToday() } }, { status: 'CANCELLED', cancelledAt: { gte: startOfToday() } }] }, _count: { _all: true } }),
      this.prisma.orderItem.groupBy({
        by: ['productId', 'productName', 'unit'],
        where: { order: { status: 'PAID', paidAt: { gte: from, lte: to } } },
        _sum: { quantity: true, totalCents: true },
        orderBy: { _sum: { totalCents: 'desc' } },
        take: 5,
      }),
    ]);

    const gross = paid.reduce((s, o) => s + o.totalCents, 0);
    const deliveryFees = paid.reduce((s, o) => s + o.deliveryFeeCents, 0);
    const refunded = refunds._sum.amountCents ?? 0;
    const byMethod = (['PIX', 'CREDIT_CARD', 'DEBIT_CARD'] as const).map((m) => {
      const amount = paid.filter((o) => o.paymentMethod === m).reduce((s, o) => s + o.totalCents, 0);
      return { method: m, amountCents: amount, share: gross ? amount / gross : 0, count: paid.filter((o) => o.paymentMethod === m).length };
    });

    const days: Array<{ date: string; amountCents: number; orders: number }> = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = localDate(d);
      const dayOrders = paid.filter((o) => o.paidAt && localDate(o.paidAt) === key);
      days.push({ date: key, amountCents: dayOrders.reduce((s, o) => s + o.totalCents, 0), orders: dayOrders.length });
      if (days.length > 400) break;
    }

    const prevGross = prevPaid._sum.totalCents ?? 0;
    const pct = (now: number, before: number) => (before ? (now - before) / before : null);
    return {
      period: { from, to },
      kpis: {
        grossCents: gross,
        grossChange: pct(gross, prevGross),
        paidOrders: paid.length,
        paidOrdersChange: pct(paid.length, prevPaid._count._all),
        averageTicketCents: paid.length ? Math.round(gross / paid.length) : 0,
        refundedCents: refunded,
        refundCount: refunds._count._all,
      },
      closing: {
        grossCents: gross,
        deliveryFeesCents: deliveryFees,
        productsCents: gross - deliveryFees,
        refundedCents: refunded,
        netCents: gross - refunded,
      },
      byMethod,
      daily: days,
      topProducts: topItems.map((t) => ({ productId: t.productId, name: t.productName, unit: t.unit, quantity: t._sum.quantity ?? 0, amountCents: t._sum.totalCents ?? 0 })),
      deliveries: Object.fromEntries(deliveriesByStatus.map((d) => [d.status, d._count._all])),
      recentOrders: recent.map((o) => ({
        id: o.id,
        code: o.code,
        customerName: `${o.user.firstName} ${o.user.lastName}`.trim(),
        status: o.status,
        deliveryStatus: o.delivery?.status ?? null,
        fulfillment: o.fulfillment,
        pickedUpAt: o.pickedUpAt,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
      })),
    };
  }

  /** CSV of paid orders for the accountant. */
  async exportCsv(fromIso?: string, toIso?: string) {
    const { from, to } = periodRange(fromIso, toIso);
    const rows = await this.prisma.order.findMany({
      where: { paidAt: { gte: from, lte: to } },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { paidAt: 'asc' },
    });
    const header = 'pedido;data_pagamento;cliente;status;tipo;forma_pagamento;subtotal;taxa_entrega;total';
    const money = (c: number) => (c / 100).toFixed(2).replace('.', ',');
    const lines = rows.map((o) =>
      [o.code, o.paidAt?.toISOString() ?? '', `${o.user.firstName} ${o.user.lastName}`.trim(), o.status, o.fulfillment, o.paymentMethod ?? '', money(o.subtotalCents), money(o.deliveryFeeCents), money(o.totalCents)].join(';'),
    );
    return [header, ...lines].join('\n');
  }
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Roles('ADMIN')
@Controller('admin/finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('dashboard')
  dashboard(@Query('from') from?: string, @Query('to') to?: string) {
    return this.finance.dashboard(from, to);
  }

  @Get('export')
  async export(@Query('from') from?: string, @Query('to') to?: string) {
    return { filename: `vendas-${from ?? 'mes'}-${to ?? 'hoje'}.csv`, csv: await this.finance.exportCsv(from, to) };
  }
}

@Module({
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
