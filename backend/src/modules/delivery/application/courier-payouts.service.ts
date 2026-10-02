import { Injectable } from '@nestjs/common';
import type { AddressSnapshot } from '../../../shared/application/integration-events.js';
import { pageArgs, paged } from '../../../shared/application/pagination.js';
import { localDate, periodRange } from '../../../shared/domain/dates.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/domain/errors.js';
import { parseJson } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { DeliveryRepository } from '../infrastructure/delivery.repository.js';

/** Fields a payout line needs; reports read the table directly (projection, not rules). */
const lineSelect = {
  id: true,
  courierId: true,
  orderCode: true,
  feeCents: true,
  customerName: true,
  addressSnapshot: true,
  deliveredAt: true,
  courierPaidAt: true,
} as const;

type LineRow = { id: string; courierId: string | null; orderCode: string; feeCents: number; customerName: string; addressSnapshot: string; deliveredAt: Date | null; courierPaidAt: Date | null };

function line(r: LineRow) {
  return {
    id: r.id,
    orderCode: r.orderCode,
    customerFirstName: r.customerName.split(' ')[0],
    neighborhood: parseJson<Partial<AddressSnapshot>>(r.addressSnapshot, {}).neighborhood ?? '',
    deliveredAt: r.deliveredAt,
    feeCents: r.feeCents,
    courierPaidAt: r.courierPaidAt,
  };
}

function sums(rows: LineRow[]) {
  const earned = rows.reduce((s, r) => s + r.feeCents, 0);
  const paid = rows.filter((r) => r.courierPaidAt).reduce((s, r) => s + r.feeCents, 0);
  return { deliveries: rows.length, earnedCents: earned, paidCents: paid, pendingCents: earned - paid };
}

/**
 * Courier fees: every DELIVERED delivery earns its courier the full delivery
 * fee the customer paid. The admin marks fees as paid in batches; that mark is
 * a bookkeeping note and cannot be undone.
 */
@Injectable()
export class CourierPayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: DeliveryRepository,
  ) {}

  private delivered(from: Date, to: Date, courierId?: string) {
    return this.prisma.delivery.findMany({
      where: { status: 'DELIVERED', courierId: courierId ?? { not: null }, deliveredAt: { gte: from, lte: to } },
      select: lineSelect,
      orderBy: { deliveredAt: 'desc' },
    });
  }

  /** Fees still owed from deliveries outside the period, so nothing older is forgotten. */
  private async pendingOutside(from: Date, to: Date, courierId?: string) {
    const rows = await this.prisma.delivery.groupBy({
      by: ['courierId'],
      where: {
        status: 'DELIVERED',
        courierPaidAt: null,
        courierId: courierId ?? { not: null },
        OR: [{ deliveredAt: { lt: from } }, { deliveredAt: { gt: to } }],
      },
      _sum: { feeCents: true },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.courierId!, { cents: r._sum.feeCents ?? 0, count: r._count._all }]));
  }

  // ------------------------------------------------------------ admin

  async adminSummary(fromIso?: string, toIso?: string) {
    const { from, to } = periodRange(fromIso, toIso);
    const [rows, outside] = await Promise.all([this.delivered(from, to), this.pendingOutside(from, to)]);
    const ids = new Set([...rows.map((r) => r.courierId!), ...outside.keys()]);
    const users = await this.prisma.user.findMany({
      where: { OR: [{ role: 'COURIER' }, { id: { in: [...ids] } }] },
      select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true, role: true },
      orderBy: { firstName: 'asc' },
    });

    const couriers = users
      .map((u) => {
        const mine = rows.filter((r) => r.courierId === u.id);
        const older = outside.get(u.id);
        return {
          id: u.id,
          name: `${u.firstName} ${u.lastName}`.trim(),
          phone: u.phone,
          avatarUrl: u.avatarUrl,
          active: u.role === 'COURIER',
          ...sums(mine),
          pendingOutsideCents: older?.cents ?? 0,
          pendingOutsideCount: older?.count ?? 0,
        };
      })
      .sort((a, b) => b.pendingCents - a.pendingCents || b.deliveries - a.deliveries || a.name.localeCompare(b.name, 'pt-BR'));

    return { period: { from, to }, totals: sums(rows), couriers };
  }

  /**
   * One courier's deliveries in the period, a page at a time. `pending` lists
   * every unpaid one of the period (id, code and fee only) so the admin can
   * select across pages and the confirmation can show the exact total.
   */
  async courierDeliveries(courierId: string, fromIso?: string, toIso?: string, page?: number) {
    const { from, to } = periodRange(fromIso, toIso);
    const p = pageArgs(page);
    const where = { status: 'DELIVERED' as const, courierId, deliveredAt: { gte: from, lte: to } };
    const [rows, total, pending] = await Promise.all([
      this.prisma.delivery.findMany({ where, select: lineSelect, orderBy: { deliveredAt: 'desc' }, skip: p.skip, take: p.take }),
      this.prisma.delivery.count({ where }),
      this.prisma.delivery.findMany({ where: { ...where, courierPaidAt: null }, select: lineSelect, orderBy: { deliveredAt: 'desc' } }),
    ]);
    return { ...paged(rows.map(line), total, p), pending: pending.map(line) };
  }

  async pay(courierId: string, deliveryIds: string[], adminId: string) {
    const ids = [...new Set(deliveryIds)];
    if (!ids.length) throw new BusinessRuleError('Selecione ao menos uma entrega.');
    const deliveries = await this.repo.find({ id: { in: ids } });
    if (deliveries.length !== ids.length) throw new NotFoundError('Entrega');
    const at = new Date();
    for (const d of deliveries) d.markCourierPaid(courierId, at);
    await this.repo.saveCourierPayout(deliveries, adminId);
    return { paidCount: deliveries.length, paidCents: deliveries.reduce((s, d) => s + d.snapshot.feeCents, 0), paidAt: at };
  }

  // ------------------------------------------------------------ courier

  async courierEarnings(courierId: string, fromIso?: string, toIso?: string) {
    const { from, to } = periodRange(fromIso, toIso);
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span - 1);
    const prevTo = new Date(from.getTime() - 1);
    const [rows, prev, outside] = await Promise.all([
      this.delivered(from, to, courierId),
      this.prisma.delivery.aggregate({ where: { status: 'DELIVERED', courierId, deliveredAt: { gte: prevFrom, lte: prevTo } }, _sum: { feeCents: true }, _count: { _all: true } }),
      this.pendingOutside(from, to, courierId),
    ]);
    const s = sums(rows);
    const pct = (now: number, before: number) => (before ? (now - before) / before : null);

    const daily: Array<{ date: string; deliveries: number; amountCents: number }> = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = localDate(d);
      const day = rows.filter((r) => r.deliveredAt && localDate(r.deliveredAt) === key);
      daily.push({ date: key, deliveries: day.length, amountCents: day.reduce((t, r) => t + r.feeCents, 0) });
      if (daily.length > 400) break;
    }

    const items = rows.map(line);
    const hoods = new Map<string, { neighborhood: string; deliveries: number; amountCents: number }>();
    for (const i of items) {
      const h = hoods.get(i.neighborhood) ?? { neighborhood: i.neighborhood || 'Sem bairro', deliveries: 0, amountCents: 0 };
      h.deliveries += 1;
      h.amountCents += i.feeCents;
      hoods.set(i.neighborhood, h);
    }
    const older = outside.get(courierId);

    return {
      period: { from, to },
      kpis: {
        deliveries: s.deliveries,
        deliveriesChange: pct(s.deliveries, prev._count._all),
        earnedCents: s.earnedCents,
        earnedChange: pct(s.earnedCents, prev._sum.feeCents ?? 0),
        receivedCents: s.paidCents,
        pendingCents: s.pendingCents,
        averageFeeCents: s.deliveries ? Math.round(s.earnedCents / s.deliveries) : 0,
        pendingOutsideCents: older?.cents ?? 0,
        pendingOutsideCount: older?.count ?? 0,
      },
      daily,
      byNeighborhood: [...hoods.values()].sort((a, b) => b.amountCents - a.amountCents).slice(0, 5),
      items,
    };
  }
}
