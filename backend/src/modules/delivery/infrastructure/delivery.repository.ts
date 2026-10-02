import { Injectable } from '@nestjs/common';
import { AddressSnapshot } from '../../../shared/application/integration-events.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import { parseJson } from '../../../shared/domain/text.js';
import { DomainEventPublisher } from '../../../shared/infrastructure/events/domain-event-publisher.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { Delivery, DeliveryStatus } from '../domain/delivery.js';

const include = { courier: { select: { firstName: true, lastName: true } }, order: { select: { userId: true } } } satisfies Prisma.DeliveryInclude;
type Row = Prisma.DeliveryGetPayload<{ include: typeof include }>;

@Injectable()
export class DeliveryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventPublisher,
  ) {}

  private toDomain(r: Row): Delivery {
    return Delivery.restore({
      id: r.id,
      orderId: r.orderId,
      orderCode: r.orderCode,
      customerUserId: r.order.userId,
      status: r.status,
      courierId: r.courierId,
      courierName: r.courier ? `${r.courier.firstName} ${r.courier.lastName}`.trim() : null,
      feeCents: r.feeCents,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      address: parseJson<AddressSnapshot>(r.addressSnapshot, {} as AddressSnapshot),
      latitude: r.latitude,
      longitude: r.longitude,
      items: parseJson(r.itemsSummary, []),
      failureReason: r.failureReason,
      failureNotes: r.failureNotes,
      startedAt: r.startedAt,
      deliveredAt: r.deliveredAt,
      failedAt: r.failedAt,
      cancelledAt: r.cancelledAt,
      courierPaidAt: r.courierPaidAt,
      createdAt: r.createdAt,
    });
  }

  async byId(id: string) {
    const r = await this.prisma.delivery.findUnique({ where: { id }, include });
    return r ? this.toDomain(r) : null;
  }

  async byOrder(orderId: string) {
    const r = await this.prisma.delivery.findUnique({ where: { orderId }, include });
    return r ? this.toDomain(r) : null;
  }

  async find(where: Prisma.DeliveryWhereInput, orderBy: Prisma.DeliveryOrderByWithRelationInput = { createdAt: 'asc' }, take?: number) {
    const rows = await this.prisma.delivery.findMany({ where, include, orderBy, take });
    return rows.map((r) => this.toDomain(r));
  }

  async insert(d: Delivery) {
    const s = d.snapshot;
    const existing = await this.prisma.delivery.findUnique({ where: { orderId: s.orderId } });
    if (existing) return; // OrderPaid delivered twice
    await this.prisma.delivery.create({
      data: {
        orderId: s.orderId,
        orderCode: s.orderCode,
        status: s.status,
        feeCents: s.feeCents,
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        addressSnapshot: JSON.stringify(s.address),
        latitude: s.latitude,
        longitude: s.longitude,
        itemsSummary: JSON.stringify(s.items),
      },
    });
  }

  /**
   * Optimistic update: only applies if the row is still in `expected` status,
   * so two couriers tapping "iniciar" at once cannot both win.
   */
  async save(d: Delivery, expected: DeliveryStatus) {
    const s = d.snapshot;
    const res = await this.prisma.delivery.updateMany({
      where: { id: s.id, status: expected },
      data: {
        status: s.status,
        courierId: s.courierId,
        failureReason: s.failureReason,
        failureNotes: s.failureNotes,
        startedAt: s.startedAt,
        deliveredAt: s.deliveredAt,
        failedAt: s.failedAt,
        cancelledAt: s.cancelledAt,
      },
    });
    if (res.count === 0) throw new ConflictError('Esta entrega acabou de ser atualizada por outra pessoa. Atualize a tela.');
    this.events.publish(...d.pullEvents());
  }

  /**
   * Persists a payout batch all-or-nothing. The `courierPaidAt: null` guard
   * makes a second admin paying the same deliveries at once fail instead of
   * silently paying twice.
   */
  async saveCourierPayout(deliveries: Delivery[], paidById: string) {
    await this.prisma.$transaction(async (tx) => {
      for (const d of deliveries) {
        const s = d.snapshot;
        const res = await tx.delivery.updateMany({
          where: { id: s.id, courierId: s.courierId, status: 'DELIVERED', courierPaidAt: null },
          data: { courierPaidAt: s.courierPaidAt, courierPaidById: paidById },
        });
        if (res.count === 0) throw new ConflictError(`A entrega ${s.orderCode} acabou de ser atualizada por outra pessoa. Atualize a tela.`);
      }
    });
  }
}
