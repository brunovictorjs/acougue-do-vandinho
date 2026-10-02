import { AddressSnapshot, Events } from '../../../shared/application/integration-events.js';
import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { BusinessRuleError, ForbiddenError } from '../../../shared/domain/errors.js';

export type DeliveryStatus = 'AWAITING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'NOT_DELIVERED';

export const FAILURE_REASONS = ['Cliente ausente', 'Endereço não encontrado', 'Cliente recusou o pedido', 'Outro motivo'] as const;

export interface DeliveryProps {
  id: string;
  orderId: string;
  orderCode: string;
  customerUserId: string;
  status: DeliveryStatus;
  courierId: string | null;
  courierName: string | null;
  feeCents: number;
  customerName: string;
  customerPhone: string | null;
  address: AddressSnapshot;
  latitude: number | null;
  longitude: number | null;
  items: Array<{ name: string; quantity: number; unit: string }>;
  failureReason: string | null;
  failureNotes: string | null;
  startedAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  /** When the admin paid this delivery's fee to the courier. Once set, never cleared. */
  courierPaidAt: Date | null;
  createdAt: Date;
}

/**
 * Delivery lifecycle:
 *   AWAITING ──courier picks──▶ IN_TRANSIT ──▶ DELIVERED
 *      │                            └───────▶ NOT_DELIVERED ──admin──▶ AWAITING
 *      └──order cancelled──▶ CANCELLED
 * Couriers never see DELIVERED or CANCELLED deliveries.
 */
export class Delivery extends AggregateRoot {
  private constructor(private props: DeliveryProps) {
    super();
  }

  static restore(props: DeliveryProps) {
    return new Delivery(props);
  }

  static create(
    input: Omit<DeliveryProps, 'id' | 'status' | 'courierId' | 'courierName' | 'failureReason' | 'failureNotes' | 'startedAt' | 'deliveredAt' | 'failedAt' | 'cancelledAt' | 'courierPaidAt' | 'createdAt'>,
  ) {
    return new Delivery({
      ...input,
      id: '',
      status: 'AWAITING',
      courierId: null,
      courierName: null,
      failureReason: null,
      failureNotes: null,
      startedAt: null,
      deliveredAt: null,
      failedAt: null,
      cancelledAt: null,
      courierPaidAt: null,
      createdAt: new Date(),
    });
  }

  get id() {
    return this.props.id;
  }
  get status() {
    return this.props.status;
  }
  get snapshot(): Readonly<DeliveryProps> {
    return this.props;
  }

  isVisibleTo(courierId: string) {
    if (this.props.status === 'AWAITING') return true;
    return this.props.courierId === courierId && (this.props.status === 'IN_TRANSIT' || this.props.status === 'NOT_DELIVERED');
  }

  private base() {
    return {
      deliveryId: this.props.id,
      orderId: this.props.orderId,
      orderCode: this.props.orderCode,
      customerUserId: this.props.customerUserId,
      courierName: this.props.courierName,
    };
  }

  private assertCourier(courierId: string) {
    if (this.props.courierId !== courierId) throw new ForbiddenError('Esta entrega está com outro entregador.');
  }

  start(courier: { id: string; name: string }) {
    if (this.props.status !== 'AWAITING') throw new BusinessRuleError('Esta entrega não está mais disponível.', 'delivery_unavailable');
    this.props.status = 'IN_TRANSIT';
    this.props.courierId = courier.id;
    this.props.courierName = courier.name;
    this.props.startedAt = new Date();
    this.raise({ name: Events.DeliveryStarted, ...this.base() });
  }

  complete(courierId: string) {
    this.assertCourier(courierId);
    if (this.props.status !== 'IN_TRANSIT') throw new BusinessRuleError('Só entregas em andamento podem ser concluídas.');
    this.props.status = 'DELIVERED';
    this.props.deliveredAt = new Date();
    this.raise({ name: Events.DeliveryCompleted, ...this.base() });
  }

  fail(courierId: string, reason: string, notes: string | null) {
    this.assertCourier(courierId);
    if (this.props.status !== 'IN_TRANSIT') throw new BusinessRuleError('Só entregas em andamento podem ser marcadas como não entregues.');
    if (!reason.trim()) throw new BusinessRuleError('Informe o motivo.');
    this.props.status = 'NOT_DELIVERED';
    this.props.failureReason = reason.trim();
    this.props.failureNotes = notes?.trim() || null;
    this.props.failedAt = new Date();
    this.raise({ name: Events.DeliveryFailed, ...this.base(), reason: this.props.failureReason });
  }

  /** Follows the order being cancelled. Returns false when there is nothing to do. */
  cancel(): boolean {
    if (this.props.status === 'CANCELLED') return false;
    if (this.props.status !== 'AWAITING' && this.props.status !== 'NOT_DELIVERED') {
      throw new BusinessRuleError('A entrega já está em rota ou concluída.');
    }
    this.props.status = 'CANCELLED';
    this.props.cancelledAt = new Date();
    return true;
  }

  /**
   * Admin records that the courier received this delivery's fee. Only completed
   * deliveries earn a fee, and the mark is irreversible (a bookkeeping note for
   * the admin — no money moves through the system).
   */
  markCourierPaid(courierId: string, at = new Date()) {
    if (this.props.status !== 'DELIVERED') throw new BusinessRuleError(`A entrega ${this.props.orderCode} não foi concluída.`, 'payout_not_delivered');
    if (this.props.courierId !== courierId) throw new BusinessRuleError(`A entrega ${this.props.orderCode} é de outro entregador.`, 'payout_wrong_courier');
    if (this.props.courierPaidAt) throw new BusinessRuleError(`A taxa da entrega ${this.props.orderCode} já foi paga.`, 'payout_already_paid');
    this.props.courierPaidAt = at;
  }

  /** Admin puts a failed delivery back in the queue for another attempt. */
  reschedule() {
    if (this.props.status !== 'NOT_DELIVERED') throw new BusinessRuleError('Só entregas não realizadas podem ser reagendadas.');
    const base = this.base();
    this.props.status = 'AWAITING';
    this.props.courierId = null;
    this.props.courierName = null;
    this.props.startedAt = null;
    this.raise({ name: Events.DeliveryRescheduled, ...base });
  }
}
