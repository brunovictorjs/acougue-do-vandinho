"use client"

import { ShoppingBagIcon } from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAddToCart } from "@/hooks/use-cart"
import { money } from "@/lib/format"
import type { ProductDetail } from "@/lib/types"
import { QuantityStepper } from "../quantity-stepper"

export function PurchasePanel({ product }: { product: ProductDetail }) {
  const add = useAddToCart()
  const [cut, setCut] = React.useState(product.cutOptions[0] ?? "")
  const [quantity, setQuantity] = React.useState(product.unit === "KG" ? Math.max(product.minQuantity, 1) : product.minQuantity)
  const [notes, setNotes] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const total = Math.round(product.priceCents * quantity)

  async function submit() {
    setBusy(true)
    const ok = await add({ productId: product.id, quantity, cutOption: cut || null, notes: notes || null })
    if (ok) setNotes("")
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5">
      {product.cutOptions.length > 0 && (
        <Field>
          <FieldLabel className="label-caps text-muted-foreground">Como você quer o corte?</FieldLabel>
          <ToggleGroup variant="chip" size="none" className="flex-wrap" value={[cut]} onValueChange={(v) => v[0] && setCut(v[0])}>
            {product.cutOptions.map((c) => (
              <ToggleGroupItem key={c} value={c}>
                {c}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="label-caps text-muted-foreground">Quantidade</span>
          {product.unit === "KG" && <span className="text-xs text-muted-foreground">Peso aproximado, ajustado na balança</span>}
        </div>
        <QuantityStepper size="lg" value={quantity} unit={product.unit} min={product.minQuantity} step={product.quantityStep} onChange={setQuantity} disabled={!product.available} />
      </div>
      <Field>
        <FieldLabel htmlFor="notes" className="label-caps text-muted-foreground">
          Observação para o açougueiro
        </FieldLabel>
        <Textarea id="notes" rows={2} maxLength={200} placeholder="Ex.: bifes de 2 cm, tirar parte da gordura" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {/* Sticky buy bar on mobile, inline on desktop. */}
      <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-t bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
        <div className="flex min-w-24 flex-col">
          <span className="text-xs text-muted-foreground">Total estimado</span>
          <span className="font-heading text-2xl font-semibold text-gold-text">{money(total)}</span>
        </div>
        <Button size="xl" className="flex-1" disabled={busy || !product.available} onClick={submit}>
          {busy ? <Spinner data-icon="inline-start" /> : <ShoppingBagIcon data-icon="inline-start" />}
          {product.available ? "Adicionar" : "Indisponível"}
        </Button>
      </div>
    </div>
  )
}
