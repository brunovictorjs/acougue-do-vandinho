import { Order, PricedProduct } from './order.js';

const picanha: PricedProduct = {
  id: 'p1',
  name: 'Picanha bovina',
  unit: 'KG',
  listPriceCents: 10490,
  priceCents: 8990,
  minQuantity: 0.5,
  quantityStep: 0.5,
  cutOptions: ['Peça inteira', 'Em bifes'],
  available: true,
  published: true,
};
const pao: PricedProduct = { ...picanha, id: 'p2', name: 'Pão de alho', unit: 'PACK', listPriceCents: 1490, priceCents: 1490, minQuantity: 1, quantityStep: 1, cutOptions: [] };
const address = { label: 'Casa', zipCode: '01234-567', street: 'Rua A', number: '120', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' };

function paidOrder(fulfillment: 'DELIVERY' | 'PICKUP' = 'DELIVERY') {
  const o = Order.newCart('VND-1042', 'u1');
  o.assignId('o1');
  o.addItem(picanha, 1.5, 'Em bifes', null);
  o.addItem(pao, 1, null, null);
  if (fulfillment === 'DELIVERY') o.prepareCheckout({ fulfillment, addressId: 'a1', address, deliveryFeeCents: 800 });
  else o.prepareCheckout({ fulfillment });
  o.markPaid('PIX', { name: 'Mariana', phone: '5511987654321' });
  o.pullEvents();
  return o;
}

describe('Order', () => {
  it('computes totals, savings and delivery fee', () => {
    const o = Order.newCart('VND-1', 'u1');
    o.addItem(picanha, 1.5, 'Em bifes', null);
    o.addItem(pao, 1, null, null);
    o.prepareCheckout({ fulfillment: 'DELIVERY', addressId: 'a1', address, deliveryFeeCents: 800 });
    const s = o.snapshot;
    expect(s.subtotalCents).toBe(13485 + 1490);
    expect(s.savingsCents).toBe(15735 - 13485);
    expect(s.totalCents).toBe(13485 + 1490 + 800);
  });

  it('merges the same product/cut and validates the weight step', () => {
    const o = Order.newCart('VND-1', 'u1');
    o.addItem(picanha, 1, 'Em bifes', null);
    o.addItem(picanha, 0.5, 'Em bifes', null);
    expect(o.items).toHaveLength(1);
    expect(o.items[0].quantity).toBe(1.5);
    expect(() => o.addItem(picanha, 0.3, 'Em bifes', null)).toThrow();
  });

  it('pickup orders do not charge delivery', () => {
    const o = paidOrder('PICKUP');
    expect(o.snapshot.deliveryFeeCents).toBe(0);
    expect(o.snapshot.totalCents).toBe(13485 + 1490);
  });

  it('refuses unavailable products', () => {
    const o = Order.newCart('VND-1', 'u1');
    expect(() => o.addItem({ ...picanha, available: false }, 1, null, null)).toThrow(/indisponível/);
  });

  it('raises OrderPaid once (idempotent) with the customer contact', () => {
    const o = Order.newCart('VND-1', 'u1');
    o.assignId('o1');
    o.addItem(picanha, 1, null, null);
    o.prepareCheckout({ fulfillment: 'PICKUP' });
    expect(o.markPaid('PIX', { name: 'Mariana', phone: '55119' })).toBe(true);
    expect(o.markPaid('PIX', { name: 'Mariana', phone: '55119' })).toBe(false);
    const events = o.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: 'order.paid', orderCode: 'VND-1', fulfillment: 'PICKUP' });
  });

  it('cannot change a paid order', () => {
    const o = paidOrder();
    expect(() => o.addItem(pao, 1, null, null)).toThrow(/não pode mais ser alterado/);
  });

  it('customer cancels only while the delivery is awaiting a courier', () => {
    expect(() => paidOrder().cancel(null, 'IN_TRANSIT')).toThrow(/saiu para entrega/);
    expect(() => paidOrder().cancel(null, 'NOT_DELIVERED')).toThrow();
    const o = paidOrder();
    o.cancel('Pedi errado', 'AWAITING');
    expect(o.status).toBe('CANCELLED');
    expect(o.pullEvents()[0]).toMatchObject({ name: 'order.cancelled', totalCents: o.snapshot.totalCents });
  });

  it('admin may cancel a failed delivery; nobody cancels twice', () => {
    const o = paidOrder();
    o.cancel(null, 'NOT_DELIVERED', true);
    expect(() => o.cancel(null, 'NOT_DELIVERED', true)).toThrow(/já foi cancelado/);
  });

  it('a cart cannot be cancelled', () => {
    const o = Order.newCart('VND-1', 'u1');
    expect(() => o.cancel(null, null)).toThrow(/pedidos pagos/);
  });

  it('pickup orders can be cancelled only until staff hand them over', () => {
    const o = paidOrder('PICKUP');
    expect(o.canCancel(null)).toBe(true);
    o.markPickedUp('staff1');
    expect(o.snapshot.pickedUpById).toBe('staff1');
    expect(o.pullEvents()).toEqual([{ name: 'order.picked-up', orderId: 'o1', orderCode: 'VND-1042', userId: 'u1' }]);
    expect(o.canCancel(null)).toBe(false);
    expect(o.canCancel(null, true)).toBe(false);
    expect(() => o.cancel(null, null)).toThrow(/já foi retirado/);
    expect(() => o.cancel(null, null, true)).toThrow(/já foi retirado/);
  });

  it('only paid pickup orders can be handed over, once', () => {
    expect(() => paidOrder('DELIVERY').markPickedUp('staff1')).toThrow(/retirada/);
    const cancelled = paidOrder('PICKUP');
    cancelled.cancel(null, null);
    expect(() => cancelled.markPickedUp('staff1')).toThrow(/pagos/);
    const o = paidOrder('PICKUP');
    o.markPickedUp('staff1');
    expect(() => o.markPickedUp('staff1')).toThrow(/já foi marcado/);
  });
});
