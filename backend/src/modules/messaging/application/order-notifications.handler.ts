import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppConfig } from '../../../config/app-config.js';
import {
  Events,
  type CustomerOnboardedEvent,
  type DeliveryCompletedEvent,
  type DeliveryFailedEvent,
  type DeliveryRescheduledEvent,
  type DeliveryStartedEvent,
  type OrderCancelledEvent,
  type OrderPaidEvent,
  type OrderPickedUpEvent,
  type PhoneVerificationRequestedEvent,
  type RefundCompletedEvent,
} from '../../../shared/application/integration-events.js';
import { UserDirectory } from '../../identity/application/user-directory.js';
import { StoreSettingsService } from '../../store/application/store-settings.service.js';
import type { NotificationTemplate } from '../../store/domain/notification-templates.js';
import { Templates } from '../domain/templates.js';
import { Priority, SendOptions, WhatsAppSender } from './whatsapp-sender.service.js';

/**
 * Short-lived key for events a person can fire twice by double-tapping, but
 * which may also happen again legitimately later (a delivery restarted after
 * being rescheduled). Collapses a burst without ever swallowing a real retry.
 */
const burstKey = (name: string, id: string, windowMs = 60_000) => `${name}:${id}:${Math.floor(Date.now() / windowMs)}`;

/**
 * Turns business events into WhatsApp messages. Every order message goes ONLY
 * to the phone of the customer who owns that order (resolved from the order's
 * userId, never from anything the message sender typed).
 *
 * Messages are queued, not sent: see WhatsAppSender / OutboxWorker. The
 * `idempotencyKey` on each send is what keeps a redelivered payment webhook
 * from messaging the customer twice about the same order.
 */
@Injectable()
export class OrderNotificationsHandler {
  private readonly logger = new Logger('Notifications');

  constructor(
    private readonly sender: WhatsAppSender,
    private readonly users: UserDirectory,
    private readonly store: StoreSettingsService,
    private readonly config: AppConfig,
  ) {}

  private link(orderId: string) {
    return `${this.config.frontendUrl}/pedidos/${orderId}`;
  }

  private async ownerPhone(userId: string) {
    const u = await this.users.contact(userId);
    if (!u?.phone) this.logger.warn(`Usuário ${userId} sem telefone — aviso não enviado.`);
    return u?.phone ?? null;
  }

  private async notify(template: NotificationTemplate, userId: string, body: string, meta: Record<string, unknown>, options?: SendOptions) {
    if (!(await this.store.isNotificationEnabled(template))) return null;
    const phone = await this.ownerPhone(userId);
    if (phone) await this.sender.text(phone, body, { template, ...meta }, options);
    return phone;
  }

  @OnEvent(Events.PhoneVerificationRequested)
  async phoneCode(e: PhoneVerificationRequestedEvent) {
    // Sent to the number being verified (not yet on the profile). No
    // idempotency key: each request mints a new code and must go through.
    // Priority, because someone is staring at the input waiting for it.
    await this.sender.text(e.phone, Templates.phoneCode(e.code), { template: 'phone_code', userId: e.userId }, { priority: Priority.interactive });
  }

  @OnEvent(Events.CustomerOnboarded)
  async welcome(e: CustomerOnboardedEvent) {
    if (!(await this.store.isNotificationEnabled('welcome'))) return;
    await this.sender.text(
      e.phone,
      Templates.welcome(e.firstName, this.config.frontendUrl),
      { template: 'welcome', userId: e.userId },
      { idempotencyKey: `welcome:${e.userId}` },
    );
  }

  @OnEvent(Events.OrderPaid)
  async paid(e: OrderPaidEvent) {
    const meta = { orderId: e.orderId, orderCode: e.orderCode };
    if (e.fulfillment === 'DELIVERY' && e.address) {
      await this.notify(
        'paid',
        e.userId,
        Templates.paidDelivery({ code: e.orderCode, method: e.paymentMethod, items: e.items, address: e.address, feeCents: e.deliveryFeeCents, totalCents: e.totalCents, link: this.link(e.orderId) }),
        meta,
        { idempotencyKey: `paid:${e.orderId}` },
      );
      return;
    }
    const s = await this.store.get();
    const hours = s.hours.map((h) => `${h.label} ${h.value}`).join(' · ');
    const phone = await this.notify(
      'pickup',
      e.userId,
      Templates.paidPickup({ code: e.orderCode, method: e.paymentMethod, items: e.items, totalCents: e.totalCents, storeAddress: s.addressLine, hours, link: this.link(e.orderId) }),
      meta,
      { idempotencyKey: `pickup:${e.orderId}` },
    );
    if (phone && s.latitude != null && s.longitude != null) {
      // Queued right behind the text above, and the queue spaces them out —
      // this pair used to leave as two back-to-back calls to WhatsApp.
      await this.sender.location(
        phone,
        { latitude: s.latitude, longitude: s.longitude, title: s.name, address: s.addressLine },
        { template: 'pickup', ...meta },
        { idempotencyKey: `pickup-location:${e.orderId}` },
      );
    }
  }

  @OnEvent(Events.DeliveryStarted)
  async started(e: DeliveryStartedEvent) {
    await this.notify('started', e.customerUserId, Templates.started(e.orderCode, e.courierName, e.deliveryCode), { orderId: e.orderId, orderCode: e.orderCode }, { idempotencyKey: burstKey('started', e.deliveryId) });
  }

  @OnEvent(Events.DeliveryCompleted)
  async delivered(e: DeliveryCompletedEvent) {
    await this.notify('delivered', e.customerUserId, Templates.delivered(e.orderCode, this.link(e.orderId)), { orderId: e.orderId, orderCode: e.orderCode }, { idempotencyKey: `delivered:${e.deliveryId}` });
  }

  @OnEvent(Events.OrderPickedUp)
  async pickedUp(e: OrderPickedUpEvent) {
    await this.notify('picked_up', e.userId, Templates.pickedUp(e.orderCode, this.link(e.orderId)), { orderId: e.orderId, orderCode: e.orderCode }, { idempotencyKey: `picked_up:${e.orderId}` });
  }

  @OnEvent(Events.DeliveryFailed)
  async failed(e: DeliveryFailedEvent) {
    await this.notify('failed', e.customerUserId, Templates.failed(e.orderCode, e.reason), { orderId: e.orderId, orderCode: e.orderCode }, { idempotencyKey: burstKey('failed', e.deliveryId) });
  }

  @OnEvent(Events.DeliveryRescheduled)
  async rescheduled(e: DeliveryRescheduledEvent) {
    await this.notify('failed', e.customerUserId, Templates.rescheduled(e.orderCode), { orderId: e.orderId, orderCode: e.orderCode }, { idempotencyKey: burstKey('rescheduled', e.deliveryId) });
  }

  @OnEvent(Events.OrderCancelled)
  async cancelled(e: OrderCancelledEvent) {
    await this.notify('cancelled', e.userId, Templates.cancelled(e.orderCode, e.totalCents, e.paymentMethod), { orderId: e.orderId, orderCode: e.orderCode }, { idempotencyKey: `cancelled:${e.orderId}` });
  }

  @OnEvent(Events.RefundCompleted)
  async refunded(e: RefundCompletedEvent) {
    await this.notify('refunded', e.userId, Templates.refunded(e.orderCode, e.amountCents), { orderId: e.orderId, orderCode: e.orderCode }, { idempotencyKey: `refunded:${e.orderId}:${e.amountCents}` });
  }
}
