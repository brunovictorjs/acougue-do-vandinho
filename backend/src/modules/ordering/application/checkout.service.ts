import { Injectable } from '@nestjs/common';
import type { AddressSnapshot, PaymentMethodKind } from '../../../shared/application/integration-events.js';
import { BusinessRuleError } from '../../../shared/domain/errors.js';
import { formatQuantity } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { UserDirectory } from '../../identity/application/user-directory.js';
import { PaymentsService } from '../../payments/application/payments.service.js';
import { DeliveryZonesService } from '../../store/application/delivery-zones.service.js';
import { OrderRepository } from '../infrastructure/order.repository.js';
import { PricingAdapter } from './pricing.adapter.js';

export interface CheckoutInput {
  fulfillment: 'DELIVERY' | 'PICKUP';
  addressId?: string;
  paymentMethod?: PaymentMethodKind;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly pricing: PricingAdapter,
    private readonly payments: PaymentsService,
    private readonly zones: DeliveryZonesService,
    private readonly users: UserDirectory,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveAddress(userId: string, addressId: string) {
    const a = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!a) throw new BusinessRuleError('Escolha um endereço de entrega válido.');
    const quote = await this.zones.quote(a.neighborhood);
    if (!quote.served || quote.feeCents == null) {
      throw new BusinessRuleError(`Ainda não entregamos em ${a.neighborhood}. Escolha outro endereço ou retire na loja.`, 'area_not_served');
    }
    const snapshot: AddressSnapshot = {
      label: a.label,
      zipCode: a.zipCode,
      street: a.street,
      number: a.number,
      complement: a.complement,
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      reference: a.reference,
      latitude: a.latitude,
      longitude: a.longitude,
    };
    return { snapshot, feeCents: quote.feeCents };
  }

  /** Locks the cart's fulfilment + price and opens a payment with the gateway. */
  async start(userId: string, input: CheckoutInput) {
    const cart = await this.orders.cartOf(userId);
    if (!cart || !cart.items.length) throw new BusinessRuleError('Seu carrinho está vazio.', 'empty_cart');

    const products = await this.pricing.many(cart.items.map((i) => i.productId));
    const unavailable = cart.unavailableItems(products);
    if (unavailable.length) {
      throw new BusinessRuleError(`Remova do carrinho: ${unavailable.map((i) => i.productName).join(', ')} (indisponível).`, 'product_unavailable');
    }
    cart.reprice(products);

    if (input.fulfillment === 'DELIVERY') {
      if (!input.addressId) throw new BusinessRuleError('Escolha um endereço de entrega.');
      const { snapshot, feeCents } = await this.resolveAddress(userId, input.addressId);
      cart.prepareCheckout({ fulfillment: 'DELIVERY', addressId: input.addressId, address: snapshot, deliveryFeeCents: feeCents });
    } else {
      cart.prepareCheckout({ fulfillment: 'PICKUP' });
    }
    await this.orders.save(cart);

    const s = cart.snapshot;
    const user = await this.users.contact(userId);
    const lines = s.items.map((i) => ({
      name: `${i.productName} · ${formatQuantity(i.quantity, i.unit)}${i.cutOption ? ` · ${i.cutOption}` : ''}`,
      amountCents: i.totalCents,
    }));
    if (s.fulfillment === 'DELIVERY') lines.push({ name: `Entrega · ${s.address?.neighborhood}`, amountCents: s.deliveryFeeCents });

    const payment = await this.payments.start({
      orderId: s.id,
      orderCode: s.code,
      amountCents: s.totalCents,
      lines,
      customerEmail: user?.email ?? '',
      method: this.payments.provider === 'fake' ? (input.paymentMethod ?? 'PIX') : null,
    });
    return { orderId: s.id, code: s.code, totalCents: s.totalCents, payment };
  }
}
