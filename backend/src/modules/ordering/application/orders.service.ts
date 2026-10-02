import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Events,
  type OrderPaidEvent,
  type PaymentSucceededEvent,
} from '../../../shared/application/integration-events.js';
import { dayRange } from '../../../shared/domain/dates.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { parseJson } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { ProductsAdminService } from '../../catalog/application/products-admin.service.js';
import { DeliveriesService } from '../../delivery/application/deliveries.service.js';
import { UserDirectory } from '../../identity/application/user-directory.js';
import { PaymentsService } from '../../payments/application/payments.service.js';
import { Order } from '../domain/order.js';
import { OrderRepository } from '../infrastructure/order.repository.js';

type OrderStatus = 'CART' | 'PAID' | 'CANCELLED';

export interface AdminOrderFilters {
  status?: OrderStatus;
  fulfillment?: 'DELIVERY' | 'PICKUP';
  paymentMethod?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';
  search?: string;
  from?: string;
  to?: string;
  page?: number;
}

const listInclude = {
  items: { select: { productName: true } },
  delivery: { select: { status: true } },
  user: { select: { firstName: true, lastName: true, phone: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger('Orders');

  constructor(
    private readonly repo: OrderRepository,
    private readonly prisma: PrismaService,
    private readonly deliveries: DeliveriesService,
    private readonly payments: PaymentsService,
    private readonly users: UserDirectory,
    private readonly products: ProductsAdminService,
  ) {}

  // ------------------------------------------------------------ reactions

  @OnEvent(Events.PaymentSucceeded)
  async onPaymentSucceeded(e: PaymentSucceededEvent) {
    const order = await this.repo.byId(e.orderId);
    if (!order) return;
    const contact = await this.users.contact(order.userId);
    const changed = order.markPaid(e.method, { name: contact?.fullName ?? 'Cliente', phone: contact?.phone ?? null });
    if (changed) {
      await this.repo.save(order);
      this.logger.log(`Pedido ${order.code} pago via ${e.method}`);
    }
  }

  @OnEvent(Events.OrderPaid)
  async onOrderPaid(e: OrderPaidEvent) {
    await this.products.addSold(e.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
  }

  // ------------------------------------------------------------ views

  private summary(o: Prisma.OrderGetPayload<{ include: typeof listInclude }>) {
    return {
      id: o.id,
      code: o.code,
      status: o.status,
      fulfillment: o.fulfillment,
      paymentMethod: o.paymentMethod,
      deliveryStatus: o.delivery?.status ?? null,
      totalCents: o.totalCents,
      itemNames: o.items.map((i) => i.productName),
      itemCount: o.items.length,
      customerName: `${o.user.firstName} ${o.user.lastName}`.trim(),
      customerPhone: o.user.phone,
      createdAt: o.createdAt,
      checkoutAt: o.checkoutAt,
      paidAt: o.paidAt,
      cancelledAt: o.cancelledAt,
      pickedUpAt: o.pickedUpAt,
    };
  }

  private async detailOf(order: Order, byAdmin: boolean) {
    const s = order.snapshot;
    const [delivery, payment, refund, customer] = await Promise.all([
      this.deliveries.viewByOrder(s.id),
      this.payments.latestForOrder(s.id),
      this.payments.refundForOrder(s.id),
      this.users.contact(s.userId),
    ]);
    const timeline: Array<{ key: string; label: string; at: Date | null; done: boolean }> = [
      { key: 'created', label: 'Pedido criado', at: s.createdAt, done: true },
      { key: 'paid', label: 'Pagamento aprovado', at: s.paidAt, done: !!s.paidAt },
    ];
    if (s.status === 'CANCELLED') {
      timeline.push({ key: 'cancelled', label: 'Pedido cancelado', at: s.cancelledAt, done: true });
      timeline.push({ key: 'refund', label: refund?.status === 'SUCCEEDED' ? 'Reembolso concluído' : 'Reembolso em processamento', at: refund?.completedAt ?? null, done: refund?.status === 'SUCCEEDED' });
    } else if (s.fulfillment === 'DELIVERY') {
      timeline.push({ key: 'awaiting', label: 'Aguardando entrega', at: s.paidAt, done: !!delivery });
      timeline.push({ key: 'in_transit', label: 'Entregando', at: delivery?.startedAt ?? null, done: !!delivery?.startedAt });
      if (delivery?.status === 'NOT_DELIVERED') timeline.push({ key: 'failed', label: `Não entregue · ${delivery.failureReason}`, at: delivery.failedAt, done: true });
      else timeline.push({ key: 'delivered', label: 'Entregue', at: delivery?.deliveredAt ?? null, done: !!delivery?.deliveredAt });
    } else {
      timeline.push({ key: 'pickup', label: 'Pronto para retirada na loja', at: s.paidAt, done: !!s.paidAt });
      timeline.push({ key: 'picked_up', label: 'Retirado na loja', at: s.pickedUpAt, done: !!s.pickedUpAt });
    }
    const products = await this.prisma.product.findMany({ where: { id: { in: s.items.map((i) => i.productId) } }, select: { id: true, slug: true, media: { take: 1, orderBy: { position: 'asc' }, select: { url: true } } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    return {
      id: s.id,
      code: s.code,
      status: s.status,
      fulfillment: s.fulfillment,
      address: s.address,
      paymentMethod: s.paymentMethod,
      subtotalCents: s.subtotalCents,
      savingsCents: s.savingsCents,
      deliveryFeeCents: s.deliveryFeeCents,
      totalCents: s.totalCents,
      createdAt: s.createdAt,
      checkoutAt: s.checkoutAt,
      paidAt: s.paidAt,
      cancelledAt: s.cancelledAt,
      cancelReason: s.cancelReason,
      pickedUpAt: s.pickedUpAt,
      items: s.items.map((i) => ({ ...i, slug: byId.get(i.productId)?.slug ?? null, coverUrl: byId.get(i.productId)?.media[0]?.url ?? null })),
      delivery,
      payment,
      refund,
      customer: customer ? { name: customer.fullName, phone: customer.phone, email: customer.email } : null,
      canCancel: order.canCancel(delivery?.status ?? null, byAdmin),
      canReview: s.status === 'PAID' && (s.fulfillment === 'PICKUP' ? !!s.pickedUpAt : delivery?.status === 'DELIVERED'),
      canMarkPickedUp: byAdmin && s.status === 'PAID' && s.fulfillment === 'PICKUP' && !s.pickedUpAt,
      timeline,
    };
  }

  // ------------------------------------------------------------ customer

  async listMine(userId: string, status?: OrderStatus) {
    const rows = await this.prisma.order.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
        // An untouched cart is not an "order" yet; show carts only once checkout started.
        OR: [{ status: { not: 'CART' } }, { checkoutAt: { not: null } }],
      },
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.summary(r));
  }

  private async mine(userId: string, orderId: string) {
    const order = await this.repo.byId(orderId);
    if (!order || order.userId !== userId) throw new NotFoundError('Pedido');
    return order;
  }

  async detailMine(userId: string, orderId: string) {
    return this.detailOf(await this.mine(userId, orderId), false);
  }

  async cancelMine(userId: string, orderId: string, reason: string | null) {
    const order = await this.mine(userId, orderId);
    order.cancel(reason, await this.deliveries.statusByOrder(order.id), false);
    await this.repo.save(order);
    return this.detailOf(order, false);
  }

  // ------------------------------------------------------------ admin

  async adminList(f: AdminOrderFilters) {
    const search = f.search?.trim();
    const createdAt = dayRange(f.from, f.to);
    const where: Prisma.OrderWhereInput = {
      ...(f.status ? { status: f.status } : { OR: [{ status: { not: 'CART' } }, { checkoutAt: { not: null } }] }),
      ...(f.fulfillment ? { fulfillment: f.fulfillment } : {}),
      ...(f.paymentMethod ? { paymentMethod: f.paymentMethod } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { code: { contains: search.toUpperCase() } },
                  { user: { firstName: { contains: search } } },
                  { user: { lastName: { contains: search } } },
                  { user: { phone: { contains: search.replace(/\D/g, '') || search } } },
                ],
              },
            ],
          }
        : {}),
    };
    const pageSize = 20;
    const page = Math.max(f.page ?? 1, 1);
    const [rows, total, counts] = await Promise.all([
      this.prisma.order.findMany({ where, include: listInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], where: { OR: [{ status: { not: 'CART' } }, { checkoutAt: { not: null } }], ...(createdAt ? { createdAt } : {}) }, _count: { _all: true } }),
    ]);
    return {
      total,
      page,
      pageSize,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      items: rows.map((r) => this.summary(r)),
    };
  }

  async adminDetail(orderId: string) {
    const order = await this.repo.byId(orderId);
    if (!order) throw new NotFoundError('Pedido');
    return this.detailOf(order, true);
  }

  async markPickedUp(orderId: string, staffId: string) {
    const order = await this.repo.byId(orderId);
    if (!order) throw new NotFoundError('Pedido');
    order.markPickedUp(staffId);
    await this.repo.save(order);
    return this.detailOf(order, true);
  }

  async adminCancel(orderId: string, reason: string | null) {
    const order = await this.repo.byId(orderId);
    if (!order) throw new NotFoundError('Pedido');
    order.cancel(reason ?? 'Cancelado pela loja', await this.deliveries.statusByOrder(order.id), true);
    await this.repo.save(order);
    return this.detailOf(order, true);
  }

  // ------------------------------------------------------------ queries for other contexts

  /** Reviews: only customers who actually received the product may review it. */
  async hasReceived(userId: string, productId: string) {
    const count = await this.prisma.order.count({
      where: {
        userId,
        status: 'PAID',
        items: { some: { productId } },
        OR: [{ fulfillment: 'PICKUP', pickedUpAt: { not: null } }, { delivery: { status: 'DELIVERED' } }],
      },
    });
    return count > 0;
  }

  /** Assistant: orders of the customer talking on WhatsApp (never anyone else's). */
  async recentForCustomer(userId: string, limit = 5) {
    const rows = await this.prisma.order.findMany({
      where: { userId, status: { in: ['PAID', 'CANCELLED'] } },
      include: { ...listInclude, items: { select: { productName: true, quantity: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((o) => ({
      code: o.code,
      status: o.status,
      deliveryStatus: o.delivery?.status ?? null,
      fulfillment: o.fulfillment,
      pickedUpAt: o.pickedUpAt,
      totalCents: o.totalCents,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      items: o.items,
      address: parseJson<{ street?: string; number?: string } | null>(o.addressSnapshot, null),
    }));
  }

  async findCodeOwner(code: string) {
    const o = await this.prisma.order.findUnique({ where: { code: code.toUpperCase() }, select: { userId: true } });
    return o?.userId ?? null;
  }
}
