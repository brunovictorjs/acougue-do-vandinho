import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppConfig } from '../../../config/app-config.js';
import {
  Events,
  type DeliveryCompletedEvent,
  type DeliveryFailedEvent,
  type OrderCancelledEvent,
  type OrderPaidEvent,
  type OrderPickedUpEvent,
} from '../../../shared/application/integration-events.js';
import { UserDirectory } from '../../identity/application/user-directory.js';
import { AdminEmails, type OrderPartiesInfo } from '../domain/admin-email-templates.js';
import { AdminMailer } from './admin-mailer.service.js';

/**
 * Avisa a administração por e-mail quando um pedido muda de mão: pago,
 * cancelado, entregue (ou retirado) e não entregue. São os quatro momentos em
 * que alguém precisa abrir o painel — separar, interromper, acertar ou
 * reagendar.
 *
 * Os avisos do cliente continuam no WhatsApp (OrderNotificationsHandler);
 * aqui o destinatário é sempre o time da loja.
 */
@Injectable()
export class AdminOrderEmailsHandler {
  constructor(
    private readonly mailer: AdminMailer,
    private readonly users: UserDirectory,
    private readonly config: AppConfig,
  ) {}

  private adminLink(path: 'pedidos' | 'entregas') {
    return `${this.config.frontendUrl}/admin/${path}`;
  }

  /** O nome e o telefone de quem fez o pedido, resolvidos pelo userId do evento. */
  private async parties(userId: string): Promise<OrderPartiesInfo> {
    const u = await this.users.contact(userId);
    return { customerName: u?.fullName || 'Cliente', customerPhone: u?.phone ?? null };
  }

  @OnEvent(Events.OrderPaid)
  async paid(e: OrderPaidEvent) {
    await this.mailer.notify(
      'paid',
      AdminEmails.paid({
        customerName: e.customerName,
        customerPhone: e.customerPhone,
        code: e.orderCode,
        method: e.paymentMethod,
        fulfillment: e.fulfillment,
        items: e.items,
        address: e.address,
        feeCents: e.deliveryFeeCents,
        totalCents: e.totalCents,
        url: this.adminLink('pedidos'),
      }),
      e.orderId,
    );
  }

  @OnEvent(Events.OrderCancelled)
  async cancelled(e: OrderCancelledEvent) {
    await this.mailer.notify(
      'cancelled',
      AdminEmails.cancelled({
        ...(await this.parties(e.userId)),
        code: e.orderCode,
        totalCents: e.totalCents,
        method: e.paymentMethod,
        reason: e.reason,
        url: this.adminLink('pedidos'),
      }),
      e.orderId,
    );
  }

  @OnEvent(Events.DeliveryCompleted)
  async delivered(e: DeliveryCompletedEvent) {
    await this.mailer.notify(
      'delivered',
      AdminEmails.delivered({ ...(await this.parties(e.customerUserId)), code: e.orderCode, courierName: e.courierName, url: this.adminLink('entregas') }),
      e.deliveryId,
    );
  }

  /** O fim de um pedido de retirada — mesmo aviso de "entregue", outro texto. */
  @OnEvent(Events.OrderPickedUp)
  async pickedUp(e: OrderPickedUpEvent) {
    await this.mailer.notify('delivered', AdminEmails.pickedUp({ ...(await this.parties(e.userId)), code: e.orderCode, url: this.adminLink('pedidos') }), e.orderId);
  }

  @OnEvent(Events.DeliveryFailed)
  async failed(e: DeliveryFailedEvent) {
    await this.mailer.notify(
      'failed',
      AdminEmails.failed({ ...(await this.parties(e.customerUserId)), code: e.orderCode, courierName: e.courierName, reason: e.reason, url: this.adminLink('entregas') }),
      // Uma entrega pode falhar de novo depois de reagendada, e esse segundo
      // aviso tem de chegar: a chave só colapsa o duplo-clique do minuto.
      `${e.deliveryId}:${Math.floor(Date.now() / 60_000)}`,
    );
  }
}
