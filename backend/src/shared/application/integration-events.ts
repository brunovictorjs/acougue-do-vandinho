/**
 * Contracts for events that cross bounded contexts. Modules never import each
 * other's internals to react to something — they subscribe to these events
 * (published through DomainEventPublisher / @nestjs/event-emitter).
 */
export type PaymentMethodKind = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';
export type UnitKind = 'KG' | 'UNIT' | 'PACK';

export interface AddressSnapshot {
  label: string;
  zipCode: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface OrderItemSummary {
  productId: string;
  name: string;
  quantity: number;
  unit: UnitKind;
  cutOption?: string | null;
  totalCents: number;
}

export const Events = {
  OrderPaid: 'order.paid',
  OrderCancelled: 'order.cancelled',
  OrderPickedUp: 'order.picked-up',
  PaymentSucceeded: 'payment.succeeded',
  PaymentFailed: 'payment.failed',
  RefundCompleted: 'refund.completed',
  DeliveryStarted: 'delivery.started',
  DeliveryCompleted: 'delivery.completed',
  DeliveryFailed: 'delivery.failed',
  DeliveryRescheduled: 'delivery.rescheduled',
  PhoneVerificationRequested: 'phone.verification-requested',
  CustomerOnboarded: 'customer.onboarded',
  WhatsAppMessageReceived: 'whatsapp.message-received',
} as const;

export interface OrderPaidEvent {
  name: typeof Events.OrderPaid;
  orderId: string;
  orderCode: string;
  userId: string;
  fulfillment: 'DELIVERY' | 'PICKUP';
  paymentMethod: PaymentMethodKind;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  address: AddressSnapshot | null;
  items: OrderItemSummary[];
  customerName: string;
  customerPhone: string | null;
}

export interface OrderPickedUpEvent {
  name: typeof Events.OrderPickedUp;
  orderId: string;
  orderCode: string;
  userId: string;
}

export interface OrderCancelledEvent {
  name: typeof Events.OrderCancelled;
  orderId: string;
  orderCode: string;
  userId: string;
  totalCents: number;
  paymentMethod: PaymentMethodKind | null;
  reason: string | null;
}

export interface PaymentSucceededEvent {
  name: typeof Events.PaymentSucceeded;
  paymentId: string;
  orderId: string;
  method: PaymentMethodKind;
  amountCents: number;
}

export interface PaymentFailedEvent {
  name: typeof Events.PaymentFailed;
  paymentId: string;
  orderId: string;
}

export interface RefundCompletedEvent {
  name: typeof Events.RefundCompleted;
  orderId: string;
  orderCode: string;
  userId: string;
  amountCents: number;
}

interface DeliveryEventBase {
  deliveryId: string;
  orderId: string;
  orderCode: string;
  customerUserId: string;
  courierName: string | null;
}

export interface DeliveryStartedEvent extends DeliveryEventBase {
  name: typeof Events.DeliveryStarted;
  /** Reminded to the customer on WhatsApp — they release the order with it. */
  deliveryCode: string;
}
export interface DeliveryCompletedEvent extends DeliveryEventBase {
  name: typeof Events.DeliveryCompleted;
}
export interface DeliveryFailedEvent extends DeliveryEventBase {
  name: typeof Events.DeliveryFailed;
  reason: string;
}
export interface DeliveryRescheduledEvent extends DeliveryEventBase {
  name: typeof Events.DeliveryRescheduled;
}

export interface PhoneVerificationRequestedEvent {
  name: typeof Events.PhoneVerificationRequested;
  userId: string;
  phone: string;
  code: string;
}

export interface CustomerOnboardedEvent {
  name: typeof Events.CustomerOnboarded;
  userId: string;
  firstName: string;
  phone: string;
}

export interface WhatsAppMessageReceivedEvent {
  name: typeof Events.WhatsAppMessageReceived;
  phone: string;
  text: string;
  senderName?: string | null;
}

export type IntegrationEvent =
  | OrderPaidEvent
  | OrderCancelledEvent
  | OrderPickedUpEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | RefundCompletedEvent
  | DeliveryStartedEvent
  | DeliveryCompletedEvent
  | DeliveryFailedEvent
  | DeliveryRescheduledEvent
  | PhoneVerificationRequestedEvent
  | CustomerOnboardedEvent
  | WhatsAppMessageReceivedEvent;
