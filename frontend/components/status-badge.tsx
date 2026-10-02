import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DeliveryStatus, OrderStatus } from "@/lib/types"

const ORDER: Record<OrderStatus, [string, string]> = {
  CART: ["No carrinho", "bg-muted text-muted-foreground"],
  PAID: ["Pago", "bg-success/15 text-success"],
  CANCELLED: ["Cancelado", "bg-destructive/15 text-destructive"],
}

type Fulfilment = DeliveryStatus | "PICKUP" | "PICKED_UP"

const DELIVERY: Record<Fulfilment, [string, string]> = {
  AWAITING: ["Aguardando entrega", "bg-warning/15 text-warning"],
  IN_TRANSIT: ["Entregando", "bg-info/15 text-info"],
  DELIVERED: ["Entregue", "bg-success/15 text-success"],
  CANCELLED: ["Cancelado", "bg-muted text-muted-foreground"],
  NOT_DELIVERED: ["Não entregue", "bg-orange/15 text-orange"],
  PICKUP: ["Aguardando retirada", "bg-warning/15 text-warning"],
  PICKED_UP: ["Retirado na loja", "bg-success/15 text-success"],
}

export const deliveryLabel = (s: DeliveryStatus) => DELIVERY[s][0]

function Dot() {
  return <span aria-hidden className="size-1.5 rounded-full bg-current" />
}

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const [label, cls] = ORDER[status]
  return (
    <Badge className={cn("h-6 px-2.5", cls, className)}>
      <Dot />
      {label}
    </Badge>
  )
}

/** Badge status for a paid order: its delivery, or the pickup hand-over. */
export const fulfilmentStatus = (o: { fulfillment: "DELIVERY" | "PICKUP"; deliveryStatus?: DeliveryStatus | null; pickedUpAt: string | null }): Fulfilment =>
  o.fulfillment === "PICKUP" ? (o.pickedUpAt ? "PICKED_UP" : "PICKUP") : (o.deliveryStatus ?? "AWAITING")

export function DeliveryStatusBadge({ status, className }: { status: Fulfilment; className?: string }) {
  const [label, cls] = DELIVERY[status]
  return (
    <Badge className={cn("h-6 px-2.5", cls, className)}>
      <Dot />
      {label}
    </Badge>
  )
}

/** Whether a delivery's fee was paid to the courier. `courier` words it from the courier's side. */
export function PayoutBadge({ paid, courier = false, className }: { paid: boolean; courier?: boolean; className?: string }) {
  const label = paid ? (courier ? "Recebido" : "Pago") : courier ? "A receber" : "Aguardando pagamento"
  return (
    <Badge className={cn("h-6 px-2.5", paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning", className)}>
      <Dot />
      {label}
    </Badge>
  )
}
