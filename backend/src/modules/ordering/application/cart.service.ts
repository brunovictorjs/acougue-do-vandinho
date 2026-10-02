import { Injectable } from '@nestjs/common';
import { PaymentsService } from '../../payments/application/payments.service.js';
import { Order } from '../domain/order.js';
import { OrderRepository } from '../infrastructure/order.repository.js';
import { PricingAdapter } from './pricing.adapter.js';

@Injectable()
export class CartService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly pricing: PricingAdapter,
    private readonly payments: PaymentsService,
  ) {}

  private async view(order: Order | null) {
    if (!order) {
      return { id: null, code: null, items: [], itemCount: 0, subtotalCents: 0, savingsCents: 0, hasUnavailable: false };
    }
    const products = await this.pricing.many(order.items.map((i) => i.productId));
    const s = order.snapshot;
    const items = s.items.map((i) => {
      const p = products.get(i.productId);
      return {
        id: i.id,
        productId: i.productId,
        slug: p?.slug ?? null,
        coverUrl: p?.coverUrl ?? null,
        name: i.productName,
        unit: i.unit,
        quantity: i.quantity,
        minQuantity: p?.minQuantity ?? 1,
        quantityStep: p?.quantityStep ?? 1,
        cutOption: i.cutOption,
        notes: i.notes,
        listPriceCents: i.listPriceCents,
        unitPriceCents: i.unitPriceCents,
        totalCents: i.totalCents,
        available: !!p && p.published && p.available,
      };
    });
    return {
      id: s.id,
      code: s.code,
      items,
      itemCount: items.length,
      subtotalCents: s.subtotalCents,
      savingsCents: s.savingsCents,
      hasUnavailable: items.some((i) => !i.available),
    };
  }

  /** Current cart with fresh prices (offers may have changed since items were added). */
  async get(userId: string) {
    const cart = await this.orders.cartOf(userId);
    if (!cart || !cart.items.length) return this.view(cart);
    const before = cart.snapshot.subtotalCents;
    cart.reprice(await this.pricing.many(cart.items.map((i) => i.productId)));
    if (cart.snapshot.subtotalCents !== before) {
      await this.payments.cancelPending(cart.id);
      await this.orders.save(cart);
      return this.view(await this.orders.byId(cart.id));
    }
    return this.view(cart);
  }

  private async mutate(userId: string, change: (cart: Order) => Promise<void> | void) {
    let cart = await this.orders.cartOf(userId);
    if (!cart) cart = Order.newCart(await this.orders.nextCode(), userId);
    await change(cart);
    if (cart.id) await this.payments.cancelPending(cart.id);
    await this.orders.save(cart);
    return this.view(await this.orders.byId(cart.id));
  }

  add(userId: string, input: { productId: string; quantity: number; cutOption?: string | null; notes?: string | null }) {
    return this.mutate(userId, async (cart) => {
      const product = await this.pricing.one(input.productId);
      cart.addItem(product, input.quantity, input.cutOption ?? null, input.notes ?? null);
    });
  }

  updateQuantity(userId: string, itemId: string, quantity: number) {
    return this.mutate(userId, async (cart) => {
      const item = cart.items.find((i) => i.id === itemId);
      const product = await this.pricing.one(item?.productId ?? '');
      cart.setQuantity(itemId, quantity, product);
    });
  }

  remove(userId: string, itemId: string) {
    return this.mutate(userId, (cart) => cart.removeItem(itemId));
  }
}
