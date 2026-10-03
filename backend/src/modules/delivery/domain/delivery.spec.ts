import { Delivery } from './delivery.js';

function fresh() {
  const d = Delivery.create({
    orderId: 'o1',
    orderCode: 'VND-1042',
    customerUserId: 'u1',
    feeCents: 800,
    customerName: 'Mariana Souza',
    customerPhone: '5511987654321',
    address: { label: 'Casa', zipCode: '01234-567', street: 'Rua A', number: '1', neighborhood: 'Centro', city: 'SP', state: 'SP' },
    latitude: null,
    longitude: null,
    items: [],
  });
  return d;
}

const carlos = { id: 'c1', name: 'Carlos' };

describe('Delivery', () => {
  it('goes AWAITING → IN_TRANSIT → DELIVERED and hides from the courier afterwards', () => {
    const d = fresh();
    expect(d.isVisibleTo('c2')).toBe(true);
    d.start(carlos);
    expect(d.status).toBe('IN_TRANSIT');
    expect(d.isVisibleTo('c2')).toBe(false);
    expect(d.isVisibleTo('c1')).toBe(true);
    d.complete('c1', d.snapshot.deliveryCode);
    expect(d.status).toBe('DELIVERED');
    expect(d.isVisibleTo('c1')).toBe(false);
    expect(d.pullEvents().map((e) => e.name)).toEqual(['delivery.started', 'delivery.completed']);
  });

  it('only the assigned courier can finish it', () => {
    const d = fresh();
    d.start(carlos);
    expect(() => d.complete('c2', d.snapshot.deliveryCode)).toThrow(/outro entregador/);
  });

  it('cannot be picked twice', () => {
    const d = fresh();
    d.start(carlos);
    expect(() => d.start({ id: 'c2', name: 'Diego' })).toThrow(/não está mais disponível/);
  });

  it('not delivered keeps the reason and can be rescheduled', () => {
    const d = fresh();
    d.start(carlos);
    d.fail('c1', 'Cliente ausente', 'toquei 3 vezes');
    expect(d.snapshot.failureReason).toBe('Cliente ausente');
    expect(d.isVisibleTo('c1')).toBe(true);
    d.reschedule();
    expect(d.status).toBe('AWAITING');
    expect(d.snapshot.courierId).toBeNull();
  });

  it('is cancelled with the order only before leaving', () => {
    const d = fresh();
    expect(d.cancel()).toBe(true);
    expect(d.isVisibleTo('c1')).toBe(false);
    const e = fresh();
    e.start(carlos);
    expect(() => e.cancel()).toThrow(/em rota/);
  });

  it("pays the courier's fee only for their completed deliveries, once", () => {
    const d = fresh();
    d.start(carlos);
    expect(() => d.markCourierPaid('c1')).toThrow(/não foi concluída/);
    d.complete('c1', d.snapshot.deliveryCode);
    expect(() => d.markCourierPaid('c2')).toThrow(/outro entregador/);
    d.markCourierPaid('c1');
    expect(d.snapshot.courierPaidAt).toBeInstanceOf(Date);
    expect(() => d.markCourierPaid('c1')).toThrow(/já foi paga/);
  });

  describe('delivery code', () => {
    it('is six digits, generated per delivery and unrelated to the order code', () => {
      const a = fresh();
      const b = fresh();
      expect(a.snapshot.deliveryCode).toMatch(/^\d{6}$/);
      expect(a.snapshot.deliveryCode).not.toBe(a.snapshot.orderCode);
      expect(a.snapshot.deliveryCode === b.snapshot.deliveryCode).toBe(false);
    });

    it('blocks the courier from completing without the right code', () => {
      const d = fresh();
      d.start(carlos);
      const right = d.snapshot.deliveryCode;
      const wrong = String((Number(right) + 1) % 1_000_000).padStart(6, '0');
      expect(() => d.complete('c1', wrong)).toThrow(/incorreto/);
      expect(() => d.complete('c1', '')).toThrow(/incorreto/);
      expect(d.status).toBe('IN_TRANSIT');
      d.complete('c1', right);
      expect(d.status).toBe('DELIVERED');
    });

    it('accepts the code as the customer reads it out, with spaces or dashes', () => {
      const d = fresh();
      d.start(carlos);
      const c = d.snapshot.deliveryCode;
      d.complete('c1', ` ${c.slice(0, 3)}-${c.slice(3)} `);
      expect(d.status).toBe('DELIVERED');
    });

    it('tells the customer the code when the delivery starts', () => {
      const d = fresh();
      d.start(carlos);
      expect(d.pullEvents()[0]).toMatchObject({ name: 'delivery.started', deliveryCode: d.snapshot.deliveryCode });
    });

    it('keeps the same code after a failed attempt is rescheduled', () => {
      const d = fresh();
      const code = d.snapshot.deliveryCode;
      d.start(carlos);
      d.fail('c1', 'Cliente ausente', null);
      d.reschedule();
      expect(d.snapshot.deliveryCode).toBe(code);
    });
  });
});
