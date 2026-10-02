import {
  AddressSnapshot,
  Events,
  PaymentMethodKind,
  UnitKind,
} from '../../../shared/application/integration-events.js';
import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/domain/errors.js';
import { lineTotal, validateQuantity } from '../../catalog/domain/pricing.js';

export type OrderStatus = 'CART' | 'PAID' | 'CANCELLED';
export type FulfillmentKind = 'DELIVERY' | 'PICKUP';
export type DeliveryStatusKind = 'AWAITING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'NOT_DELIVERED';

export interface OrderItemProps {
  id: string;
  productId: string;
  productName: string;
  unit: UnitKind;
  quantity: number;
  listPriceCents: number;
  unitPriceCents: number;
  totalCents: number;
  cutOption: string | null;
  notes: string | null;
}

/** What ordering needs to know about a product at the moment it is priced. */
export interface PricedProduct {
  id: string;
  name: string;
  unit: UnitKind;
  listPriceCents: number;
  priceCents: number;
  minQuantity: number;
  quantityStep: number;
  cutOptions: string[];
  available: boolean;
  published: boolean;
}

export interface OrderProps {
  id: string;
  code: string;
  userId: string;
  status: OrderStatus;
  fulfillment: FulfillmentKind;
  addressId: string | null;
  address: AddressSnapshot | null;
  paymentMethod: PaymentMethodKind | null;
  subtotalCents: number;
  savingsCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  checkoutAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  pickedUpAt: Date | null;
  pickedUpById: string | null;
  createdAt: Date;
  items: OrderItemProps[];
}

export interface CustomerContactInfo {
  name: string;
  phone: string | null;
}

let tempSeq = 0;
const tempId = () => `new_${Date.now().toString(36)}_${(tempSeq++).toString(36)}`;

/**
 * Order aggregate. A customer's cart IS an order in status CART; paying moves
 * it to PAID and cancelling a paid order moves it to CANCELLED (with refund).
 */
export class Order extends AggregateRoot {
  private constructor(private props: OrderProps) {
    super();
  }

  static restore(props: OrderProps) {
    return new Order(props);
  }

  static newCart(code: string, userId: string) {
    return new Order({
      id: '',
      code,
      userId,
      status: 'CART',
      fulfillment: 'DELIVERY',
      addressId: null,
      address: null,
      paymentMethod: null,
      subtotalCents: 0,
      savingsCents: 0,
      deliveryFeeCents: 0,
      totalCents: 0,
      checkoutAt: null,
      paidAt: null,
      cancelledAt: null,
      cancelReason: null,
      pickedUpAt: null,
      pickedUpById: null,
      createdAt: new Date(),
      items: [],
    });
  }

  get id() {
    return this.props.id;
  }
  get code() {
    return this.props.code;
  }
  get userId() {
    return this.props.userId;
  }
  get status() {
    return this.props.status;
  }
  get items(): readonly OrderItemProps[] {
    return this.props.items;
  }
  get snapshot(): Readonly<OrderProps> {
    return this.props;
  }

  assignId(id: string) {
    if (!this.props.id) this.props.id = id;
  }

  private assertCart() {
    if (this.props.status !== 'CART') throw new BusinessRuleError('Este pedido não pode mais ser alterado.');
  }

  private assertSellable(product: PricedProduct) {
    if (!product.published || !product.available) {
      throw new BusinessRuleError(`${product.name} está indisponível no momento.`, 'product_unavailable');
    }
  }

  addItem(product: PricedProduct, quantity: number, cutOption: string | null, notes: string | null) {
    this.assertCart();
    this.assertSellable(product);
    if (cutOption && !product.cutOptions.includes(cutOption)) throw new BusinessRuleError('Opção de corte inválida.');
    if (!cutOption && product.cutOptions.length) cutOption = product.cutOptions[0];
    const cleanNotes = notes?.trim() || null;

    const same = this.props.items.find((i) => i.productId === product.id && i.cutOption === cutOption && i.notes === cleanNotes);
    const newQuantity = round3((same?.quantity ?? 0) + quantity);
    validateQuantity(newQuantity, { ...product, unit: product.unit });
    if (same) {
      same.quantity = newQuantity;
      this.applyPrice(same, product);
    } else {
      const item: OrderItemProps = {
        id: tempId(),
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity,
        listPriceCents: product.listPriceCents,
        unitPriceCents: product.priceCents,
        totalCents: 0,
        cutOption,
        notes: cleanNotes,
      };
      this.applyPrice(item, product);
      this.props.items.push(item);
    }
    this.recalculate();
  }

  setQuantity(itemId: string, quantity: number, product: PricedProduct) {
    this.assertCart();
    const item = this.findItem(itemId);
    validateQuantity(quantity, product);
    item.quantity = round3(quantity);
    this.applyPrice(item, product);
    this.recalculate();
  }

  removeItem(itemId: string) {
    this.assertCart();
    this.findItem(itemId);
    this.props.items = this.props.items.filter((i) => i.id !== itemId);
    this.recalculate();
  }

  /** Refresh unit prices from the catalog (offers may have started/ended). */
  reprice(products: Map<string, PricedProduct>) {
    this.assertCart();
    for (const item of this.props.items) {
      const p = products.get(item.productId);
      if (p) this.applyPrice(item, p);
    }
    this.recalculate();
  }

  unavailableItems(products: Map<string, PricedProduct>) {
    return this.props.items.filter((i) => {
      const p = products.get(i.productId);
      return !p || !p.published || !p.available;
    });
  }

  /** Locks in how the order will be fulfilled; the amount charged is `totalCents`. */
  prepareCheckout(input: { fulfillment: 'PICKUP' } | { fulfillment: 'DELIVERY'; addressId: string; address: AddressSnapshot; deliveryFeeCents: number }) {
    this.assertCart();
    if (!this.props.items.length) throw new BusinessRuleError('Seu carrinho está vazio.', 'empty_cart');
    this.props.fulfillment = input.fulfillment;
    if (input.fulfillment === 'DELIVERY') {
      this.props.addressId = input.addressId;
      this.props.address = input.address;
      this.props.deliveryFeeCents = input.deliveryFeeCents;
    } else {
      this.props.addressId = null;
      this.props.address = null;
      this.props.deliveryFeeCents = 0;
    }
    this.props.checkoutAt = new Date();
    this.recalculate();
  }

  markPaid(method: PaymentMethodKind, customer: CustomerContactInfo, at = new Date()) {
    if (this.props.status === 'PAID') return false; // idempotent webhook
    this.assertCart();
    if (!this.props.checkoutAt) throw new BusinessRuleError('Pedido sem checkout.');
    this.props.status = 'PAID';
    this.props.paymentMethod = method;
    this.props.paidAt = at;
    this.raise({
      name: Events.OrderPaid,
      orderId: this.props.id,
      orderCode: this.props.code,
      userId: this.props.userId,
      fulfillment: this.props.fulfillment,
      paymentMethod: method,
      subtotalCents: this.props.subtotalCents,
      deliveryFeeCents: this.props.deliveryFeeCents,
      totalCents: this.props.totalCents,
      address: this.props.address,
      items: this.props.items.map((i) => ({
        productId: i.productId,
        name: i.productName,
        quantity: i.quantity,
        unit: i.unit,
        cutOption: i.cutOption,
        totalCents: i.totalCents,
      })),
      customerName: customer.name,
      customerPhone: customer.phone,
    });
    return true;
  }

  /**
   * Customers may cancel a paid order while its delivery is still waiting for
   * a courier (pickup orders: until staff confirm the hand-over). Admins may
   * also cancel orders whose delivery failed. Cancelling triggers the refund.
   */
  canCancel(deliveryStatus: DeliveryStatusKind | null, byAdmin = false): boolean {
    if (this.props.status !== 'PAID') return false;
    if (this.props.fulfillment === 'PICKUP') return !this.props.pickedUpAt;
    if (deliveryStatus === 'AWAITING') return true;
    return byAdmin && deliveryStatus === 'NOT_DELIVERED';
  }

  cancel(reason: string | null, deliveryStatus: DeliveryStatusKind | null, byAdmin = false) {
    if (this.props.status === 'CANCELLED') throw new BusinessRuleError('Este pedido já foi cancelado.');
    if (this.props.status !== 'PAID') throw new BusinessRuleError('Só é possível cancelar pedidos pagos.');
    if (!this.canCancel(deliveryStatus, byAdmin)) {
      throw new BusinessRuleError(
        this.props.pickedUpAt ? 'O pedido já foi retirado na loja e não pode mais ser cancelado.' : 'O pedido já saiu para entrega e não pode mais ser cancelado.',
        'cancel_not_allowed',
      );
    }
    this.props.status = 'CANCELLED';
    this.props.cancelledAt = new Date();
    this.props.cancelReason = reason?.trim() || null;
    this.raise({
      name: Events.OrderCancelled,
      orderId: this.props.id,
      orderCode: this.props.code,
      userId: this.props.userId,
      totalCents: this.props.totalCents,
      paymentMethod: this.props.paymentMethod,
      reason: this.props.cancelReason,
    });
  }

  /** Staff confirm the customer collected a pickup order at the counter. Irreversible: the order can no longer be cancelled. */
  markPickedUp(staffId: string, at = new Date()) {
    if (this.props.fulfillment !== 'PICKUP') throw new BusinessRuleError('Só pedidos de retirada podem ser marcados como retirados.');
    if (this.props.status !== 'PAID') throw new BusinessRuleError('Só pedidos pagos podem ser entregues ao cliente.');
    if (this.props.pickedUpAt) throw new BusinessRuleError('Este pedido já foi marcado como retirado.');
    this.props.pickedUpAt = at;
    this.props.pickedUpById = staffId;
    this.raise({ name: Events.OrderPickedUp, orderId: this.props.id, orderCode: this.props.code, userId: this.props.userId });
  }

  private findItem(itemId: string) {
    const item = this.props.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundError('Item do carrinho');
    return item;
  }

  private applyPrice(item: OrderItemProps, product: PricedProduct) {
    item.productName = product.name;
    item.listPriceCents = product.listPriceCents;
    item.unitPriceCents = product.priceCents;
    item.totalCents = lineTotal(product.priceCents, item.quantity);
  }

  private recalculate() {
    const p = this.props;
    p.subtotalCents = p.items.reduce((sum, i) => sum + i.totalCents, 0);
    p.savingsCents = p.items.reduce((sum, i) => sum + (lineTotal(i.listPriceCents, i.quantity) - i.totalCents), 0);
    p.totalCents = p.subtotalCents + (p.fulfillment === 'DELIVERY' ? p.deliveryFeeCents : 0);
  }
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
