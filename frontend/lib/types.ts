export type Role = "CUSTOMER" | "COURIER" | "EMPLOYEE" | "ADMIN"
export type Unit = "KG" | "UNIT" | "PACK"
export type OrderStatus = "CART" | "PAID" | "CANCELLED"
export type DeliveryStatus = "AWAITING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "NOT_DELIVERED"
export type PaymentMethod = "PIX" | "CREDIT_CARD" | "DEBIT_CARD"
export type Fulfillment = "DELIVERY" | "PICKUP"

export interface Me {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  phone: string | null
  phoneVerified: boolean
  role: Role
  addressCount: number
  onboardingComplete: boolean
}

export interface ProductCard {
  id: string
  slug: string
  name: string
  category: { id: string; name: string; slug: string }
  unit: Unit
  shortDescription: string
  listPriceCents: number
  priceCents: number
  offer: null | { id: string; name: string; showBadge: boolean; discountPercent: number; endsAt: string | null }
  ratingAvg: number
  ratingCount: number
  isNew: boolean
  available: boolean
  coverUrl: string | null
  minQuantity: number
  quantityStep: number
  cutOptions: string[]
}

export interface ProductDetail extends ProductCard {
  description: string
  media: Array<{ id: string; type: "IMAGE" | "VIDEO"; url: string; alt: string }>
}

export interface Category {
  id: string
  name: string
  slug: string
  productCount: number
}

export interface CatalogHome {
  offers: ProductCard[]
  novidades: ProductCard[]
  categories: Category[]
}

export interface ProductList {
  total: number
  page: number
  pageSize: number
  items: ProductCard[]
}

export interface StoreInfo {
  name: string
  cnpj: string
  whatsapp: string
  addressLine: string
  latitude: number | null
  longitude: number | null
  hours: Array<{ label: string; value: string }>
  about: string
}

export interface DeliveryQuote {
  served: boolean
  zoneId: string | null
  neighborhood: string
  feeCents: number | null
  etaMinutes: number | null
}

export interface Address {
  id: string
  label: string
  zipCode: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  reference: string | null
  latitude: number | null
  longitude: number | null
  isDefault: boolean
  delivery: DeliveryQuote
}

export interface CartItem {
  id: string
  productId: string
  slug: string | null
  coverUrl: string | null
  name: string
  unit: Unit
  quantity: number
  minQuantity: number
  quantityStep: number
  cutOption: string | null
  notes: string | null
  listPriceCents: number
  unitPriceCents: number
  totalCents: number
  available: boolean
}

export interface Cart {
  id: string | null
  code: string | null
  items: CartItem[]
  itemCount: number
  subtotalCents: number
  savingsCents: number
  hasUnavailable: boolean
}

export interface Payment {
  id: string
  provider: "fake" | "stripe"
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED"
  method: PaymentMethod
  amountCents: number
  clientSecret: string | null
  pix: { code: string; qrImageUrl: string | null; expiresAt: string | null } | null
  succeededAt: string | null
}

export interface CheckoutResult {
  orderId: string
  code: string
  totalCents: number
  payment: Payment
}

export interface AddressSnapshot {
  label: string
  zipCode: string
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  reference?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface OrderSummary {
  id: string
  code: string
  status: OrderStatus
  fulfillment: Fulfillment
  paymentMethod: PaymentMethod | null
  deliveryStatus: DeliveryStatus | null
  totalCents: number
  itemNames: string[]
  itemCount: number
  customerName: string
  customerPhone: string | null
  createdAt: string
  checkoutAt: string | null
  paidAt: string | null
  cancelledAt: string | null
  pickedUpAt: string | null
}

export interface DeliveryView {
  id: string
  orderId: string
  orderCode: string
  status: DeliveryStatus
  courierId: string | null
  courierName: string | null
  feeCents: number
  customerName: string
  customerFirstName: string
  customerPhone: string | null
  address: AddressSnapshot
  addressLine: string
  neighborhood: string
  latitude: number | null
  longitude: number | null
  distanceMeters: number | null
  items: Array<{ name: string; quantity: number; unit: Unit }>
  itemCount: number
  failureReason: string | null
  failureNotes: string | null
  startedAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  courierPaidAt: string | null
  createdAt: string
}

/** A completed delivery and whether its fee was already paid to the courier. */
export interface PayoutLine {
  id: string
  orderCode: string
  customerFirstName: string
  neighborhood: string
  deliveredAt: string
  feeCents: number
  courierPaidAt: string | null
}

export interface PayoutTotals {
  deliveries: number
  earnedCents: number
  paidCents: number
  pendingCents: number
}

export interface CourierPayouts {
  period: { from: string; to: string }
  totals: PayoutTotals
  couriers: Array<
    PayoutTotals & {
      id: string
      name: string
      phone: string | null
      avatarUrl: string | null
      /** False when the person no longer has the courier role. */
      active: boolean
      pendingOutsideCents: number
      pendingOutsideCount: number
    }
  >
}

/** One page of a courier's deliveries, plus every unpaid one of the period (for selecting across pages). */
export interface CourierDeliveries {
  total: number
  page: number
  pageSize: number
  items: PayoutLine[]
  pending: PayoutLine[]
}

export interface CourierEarnings {
  period: { from: string; to: string }
  kpis: {
    deliveries: number
    deliveriesChange: number | null
    earnedCents: number
    earnedChange: number | null
    receivedCents: number
    pendingCents: number
    averageFeeCents: number
    pendingOutsideCents: number
    pendingOutsideCount: number
  }
  daily: Array<{ date: string; deliveries: number; amountCents: number }>
  byNeighborhood: Array<{ neighborhood: string; deliveries: number; amountCents: number }>
  items: PayoutLine[]
}

export interface OrderDetail {
  id: string
  code: string
  status: OrderStatus
  fulfillment: Fulfillment
  address: AddressSnapshot | null
  paymentMethod: PaymentMethod | null
  subtotalCents: number
  savingsCents: number
  deliveryFeeCents: number
  totalCents: number
  createdAt: string
  checkoutAt: string | null
  paidAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  pickedUpAt: string | null
  items: Array<{
    id: string
    productId: string
    productName: string
    unit: Unit
    quantity: number
    unitPriceCents: number
    listPriceCents: number
    totalCents: number
    cutOption: string | null
    notes: string | null
    slug: string | null
    coverUrl: string | null
  }>
  delivery: DeliveryView | null
  payment: Payment | null
  refund: { status: "PENDING" | "SUCCEEDED" | "FAILED"; amountCents: number; createdAt: string; completedAt: string | null } | null
  customer: { name: string; phone: string | null; email: string } | null
  canCancel: boolean
  canReview: boolean
  canMarkPickedUp: boolean
  timeline: Array<{ key: string; label: string; at: string | null; done: boolean }>
}

export interface ReviewList {
  total: number
  page: number
  pageSize: number
  distribution: Array<{ rating: number; count: number }>
  canReview: boolean
  mine: { rating: number; comment: string | null; tags: string[] } | null
  tags: string[]
  items: Array<{ id: string; rating: number; comment: string | null; tags: string[]; author: string; avatarUrl: string | null; reply: string | null; createdAt: string }>
}
