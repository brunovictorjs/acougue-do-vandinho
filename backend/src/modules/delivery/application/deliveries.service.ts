import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Events,
  type OrderCancelledEvent,
  type OrderPaidEvent,
} from '../../../shared/application/integration-events.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/domain/errors.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { StoreSettingsService } from '../../store/application/store-settings.service.js';
import { Delivery, DeliveryStatus, FAILURE_REASONS } from '../domain/delivery.js';
import { DeliveryRepository } from '../infrastructure/delivery.repository.js';
import { RoutePlanner } from '../infrastructure/route-planner.js';
import { deliveryView } from './delivery-views.js';

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger('Deliveries');

  constructor(
    private readonly repo: DeliveryRepository,
    private readonly prisma: PrismaService,
    private readonly store: StoreSettingsService,
    private readonly routes: RoutePlanner,
  ) {}

  // ------------------------------------------------------------ reactions

  @OnEvent(Events.OrderPaid)
  async onOrderPaid(e: OrderPaidEvent) {
    if (e.fulfillment !== 'DELIVERY' || !e.address) return;
    const d = Delivery.create({
      orderId: e.orderId,
      orderCode: e.orderCode,
      customerUserId: e.userId,
      feeCents: e.deliveryFeeCents,
      customerName: e.customerName,
      customerPhone: e.customerPhone,
      address: e.address,
      latitude: e.address.latitude ?? null,
      longitude: e.address.longitude ?? null,
      items: e.items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
    });
    await this.repo.insert(d);
    this.logger.log(`Entrega criada para ${e.orderCode} (aguardando entrega)`);
  }

  @OnEvent(Events.OrderCancelled)
  async onOrderCancelled(e: OrderCancelledEvent) {
    const d = await this.repo.byOrder(e.orderId);
    if (!d) return;
    const before = d.status;
    if (d.cancel()) await this.repo.save(d, before);
  }

  // ------------------------------------------------------------ queries

  async statusByOrder(orderId: string): Promise<DeliveryStatus | null> {
    const row = await this.prisma.delivery.findUnique({ where: { orderId }, select: { status: true } });
    return row?.status ?? null;
  }

  async viewByOrder(orderId: string) {
    const d = await this.repo.byOrder(orderId);
    return d ? deliveryView(d, undefined, { includeCode: true }) : null;
  }

  // ------------------------------------------------------------ courier

  async courierBoard(courierId: string) {
    const store = await this.store.get();
    const available = await this.repo.find({ status: 'AWAITING' });
    const mine = await this.repo.find({ courierId, status: { in: ['IN_TRANSIT', 'NOT_DELIVERED'] } }, { startedAt: 'desc' });
    return {
      available: available.map((d) => deliveryView(d, store)),
      mine: mine.map((d) => deliveryView(d, store)),
      failureReasons: FAILURE_REASONS,
    };
  }

  private async forCourier(id: string, courierId: string) {
    const d = await this.repo.byId(id);
    if (!d || !d.isVisibleTo(courierId)) throw new NotFoundError('Entrega');
    return d;
  }

  async courierDetail(id: string, courierId: string) {
    const d = await this.forCourier(id, courierId);
    const store = await this.store.get();
    const s = d.snapshot;
    const hasStore = store.latitude != null && store.longitude != null;
    const hasDest = s.latitude != null && s.longitude != null;
    const route = hasStore && hasDest ? await this.routes.plan({ lat: store.latitude!, lng: store.longitude! }, { lat: s.latitude!, lng: s.longitude! }) : null;
    return {
      delivery: deliveryView(d, store),
      store: { name: store.name, addressLine: store.addressLine, latitude: store.latitude, longitude: store.longitude },
      route,
      failureReasons: FAILURE_REASONS,
    };
  }

  async start(id: string, courier: { id: string; name: string }) {
    const d = await this.forCourier(id, courier.id);
    d.start(courier);
    await this.repo.save(d, 'AWAITING');
    return this.courierDetail(id, courier.id);
  }

  async complete(id: string, courierId: string, code: string) {
    const d = await this.forCourier(id, courierId);
    d.complete(courierId, code);
    await this.repo.save(d, 'IN_TRANSIT');
    return { ok: true, status: d.status };
  }

  async fail(id: string, courierId: string, reason: string, notes: string | null) {
    if (!(FAILURE_REASONS as readonly string[]).includes(reason)) throw new BusinessRuleError('Motivo inválido.');
    const d = await this.forCourier(id, courierId);
    d.fail(courierId, reason, notes);
    await this.repo.save(d, 'IN_TRANSIT');
    return { ok: true, status: d.status };
  }

  // ------------------------------------------------------------ admin

  async adminBoard() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [open, recentDone] = await Promise.all([
      this.repo.find({ status: { in: ['AWAITING', 'IN_TRANSIT', 'NOT_DELIVERED'] } }),
      this.repo.find({ OR: [{ status: 'DELIVERED', deliveredAt: { gte: startOfDay } }, { status: 'CANCELLED', cancelledAt: { gte: startOfDay } }] }, { updatedAt: 'desc' }, 100),
    ]);
    const all = [...open, ...recentDone].map((d) => deliveryView(d, undefined, { includeCode: true }));
    const group = (s: DeliveryStatus) => all.filter((d) => d.status === s);
    const couriers = await this.prisma.user.findMany({
      where: { role: 'COURIER' },
      include: {
        deliveries: { where: { OR: [{ status: 'IN_TRANSIT' }, { deliveredAt: { gte: startOfDay } }] }, select: { status: true, feeCents: true } },
      },
      orderBy: { firstName: 'asc' },
    });
    return {
      columns: {
        AWAITING: group('AWAITING'),
        IN_TRANSIT: group('IN_TRANSIT'),
        DELIVERED: group('DELIVERED'),
        NOT_DELIVERED: group('NOT_DELIVERED'),
        CANCELLED: group('CANCELLED'),
      },
      couriers: couriers.map((c) => {
        const delivered = c.deliveries.filter((d) => d.status === 'DELIVERED');
        return {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          phone: c.phone,
          inTransit: c.deliveries.some((d) => d.status === 'IN_TRANSIT'),
          deliveredToday: delivered.length,
          feesToday: delivered.reduce((s, d) => s + d.feeCents, 0),
        };
      }),
    };
  }

  async reschedule(id: string) {
    const d = await this.repo.byId(id);
    if (!d) throw new NotFoundError('Entrega');
    d.reschedule();
    await this.repo.save(d, 'NOT_DELIVERED');
    return { ok: true };
  }
}
