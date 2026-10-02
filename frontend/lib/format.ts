import type { PaymentMethod, Unit } from "./types"

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export const money = (cents: number) => brl.format(cents / 100)

export const unitLabel: Record<Unit, string> = { KG: "kg", UNIT: "un", PACK: "pct" }
export const unitLong: Record<Unit, string> = { KG: "por kg", UNIT: "por unidade", PACK: "por pacote" }

export function qty(quantity: number, unit: Unit) {
  if (unit === "KG") return `${quantity.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`
  return `${quantity.toLocaleString("pt-BR")} ${unitLabel[unit]}`
}

export function phone(digits: string | null | undefined) {
  if (!digits) return ""
  const local = digits.startsWith("55") ? digits.slice(2) : digits
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return digits
}

export function maskPhoneInput(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function maskCep(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return ""
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (d.toDateString() === today.toDateString()) return `Hoje, ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${time}`
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${time}`
}

export function shortDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : ""
}

export const methodLabel: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
}

export function distance(meters: number | null) {
  if (meters == null) return null
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}
