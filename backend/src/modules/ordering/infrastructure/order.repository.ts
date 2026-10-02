import { Injectable } from '@nestjs/common';
import type { AddressSnapshot } from '../../../shared/application/integration-events.js';
import { parseJson } from '../../../shared/domain/text.js';
import { DomainEventPublisher } from '../../../shared/infrastructure/events/domain-event-publisher.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { Order } from '../domain/order.js';

const include = { items: { orderBy: { createdAt: 'asc' } } } satisfies Prisma.OrderInclude;
type Row = Prisma.OrderGetPayload<{ include: typeof include }>;

const CODE_START = 1001;

@Injectable()
export class OrderRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventPublisher,
  ) {}

  private toDomain(r: Row) {
    return Order.restore({
      id: r.id,
      code: r.code,
      userId: r.userId,
      status: r.status,
      fulfillment: r.fulfillment,
      addressId: r.addressId,
      address: parseJson<AddressSnapshot | null>(r.addressSnapshot, null),
      paymentMethod: r.paymentMethod,
      subtotalCents: r.subtotalCents,
      savingsCents: r.savingsCents,
      deliveryFeeCents: r.deliveryFeeCents,
      totalCents: r.totalCents,
      checkoutAt: r.checkoutAt,
      paidAt: r.paidAt,
      cancelledAt: r.cancelledAt,
      cancelReason: r.cancelReason,
      pickedUpAt: r.pickedUpAt,
      pickedUpById: r.pickedUpById,
      createdAt: r.createdAt,
      items: r.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        unit: i.unit,
        quantity: i.quantity,
        listPriceCents: i.listPriceCents,
        unitPriceCents: i.unitPriceCents,
        totalCents: i.totalCents,
        cutOption: i.cutOption,
        notes: i.notes,
      })),
    });
  }

  async nextCode() {
    return `VND-${await this.prisma.nextSequence('order_code', CODE_START)}`;
  }

  async cartOf(userId: string) {
    const r = await this.prisma.order.findFirst({ where: { userId, status: 'CART' }, include, orderBy: { createdAt: 'desc' } });
    return r ? this.toDomain(r) : null;
  }

  async byId(id: string) {
    const r = await this.prisma.order.findUnique({ where: { id }, include });
    return r ? this.toDomain(r) : null;
  }

  /** Persists the aggregate (items are replaced wholesale) and then publishes its events. */
  async save(order: Order) {
    const s = order.snapshot;
    const data = {
      status: s.status,
      fulfillment: s.fulfillment,
      addressId: s.addressId,
      addressSnapshot: s.address ? JSON.stringify(s.address) : null,
      paymentMethod: s.paymentMethod,
      subtotalCents: s.subtotalCents,
      savingsCents: s.savingsCents,
      deliveryFeeCents: s.deliveryFeeCents,
      totalCents: s.totalCents,
      checkoutAt: s.checkoutAt,
      paidAt: s.paidAt,
      cancelledAt: s.cancelledAt,
      cancelReason: s.cancelReason,
      pickedUpAt: s.pickedUpAt,
      pickedUpById: s.pickedUpById,
    };
    const items = s.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      unit: i.unit,
      quantity: i.quantity,
      listPriceCents: i.listPriceCents,
      unitPriceCents: i.unitPriceCents,
      totalCents: i.totalCents,
      cutOption: i.cutOption,
      notes: i.notes,
    }));
    await this.prisma.$transaction(async (tx) => {
      if (!s.id) {
        const created = await tx.order.create({ data: { ...data, code: s.code, userId: s.userId, createdAt: s.createdAt } });
        order.assignId(created.id);
      } else {
        await tx.order.update({ where: { id: s.id }, data });
        await tx.orderItem.deleteMany({ where: { orderId: s.id } });
      }
      // Keep ids stable for items that already existed so the UI can address them.
      for (const [idx, item] of items.entries()) {
        const id = s.items[idx].id.startsWith('new_') ? undefined : s.items[idx].id;
        await tx.orderItem.create({ data: { ...item, id, orderId: order.id, createdAt: new Date(Date.now() + idx) } });
      }
    });
    this.events.publish(...order.pullEvents());
    return order;
  }
}
