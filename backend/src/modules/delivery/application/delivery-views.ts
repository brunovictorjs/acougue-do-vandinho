import type { Delivery } from '../domain/delivery.js';
import { haversine } from '../infrastructure/route-planner.js';

export function deliveryView(d: Delivery, store?: { latitude: number | null; longitude: number | null }) {
  const s = d.snapshot;
  const a = s.address;
  const distanceMeters =
    store?.latitude != null && store.longitude != null && s.latitude != null && s.longitude != null
      ? Math.round(haversine({ lat: store.latitude, lng: store.longitude }, { lat: s.latitude, lng: s.longitude }))
      : null;
  return {
    id: s.id,
    orderId: s.orderId,
    orderCode: s.orderCode,
    status: s.status,
    courierId: s.courierId,
    courierName: s.courierName,
    feeCents: s.feeCents,
    customerName: s.customerName,
    customerFirstName: s.customerName.split(' ')[0],
    customerPhone: s.customerPhone,
    address: a,
    addressLine: `${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ''}`,
    neighborhood: a.neighborhood,
    latitude: s.latitude,
    longitude: s.longitude,
    distanceMeters,
    items: s.items,
    itemCount: s.items.length,
    failureReason: s.failureReason,
    failureNotes: s.failureNotes,
    startedAt: s.startedAt,
    deliveredAt: s.deliveredAt,
    failedAt: s.failedAt,
    cancelledAt: s.cancelledAt,
    courierPaidAt: s.courierPaidAt,
    createdAt: s.createdAt,
  };
}

export type DeliveryView = ReturnType<typeof deliveryView>;
