"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { qty } from "@/lib/format"
import type { Unit } from "@/lib/types"

/** − / quantity / + control that follows the product's selling step (e.g. 0,5 kg). */
export function QuantityStepper({
  value,
  unit,
  min,
  step,
  max = 50,
  onChange,
  disabled,
  size = "default",
}: {
  value: number
  unit: Unit
  min: number
  step: number
  max?: number
  onChange: (value: number) => void
  disabled?: boolean
  size?: "default" | "lg"
}) {
  const round = (n: number) => Math.round(n * 1000) / 1000
  const iconSize = size === "lg" ? "icon-lg" : "icon"
  return (
    <ButtonGroup aria-label="Quantidade">
      <Button variant="outline" size={iconSize} disabled={disabled || value - step < min - 1e-9} onClick={() => onChange(round(value - step))} aria-label="Diminuir">
        <MinusIcon />
      </Button>
      <ButtonGroupText className={size === "lg" ? "min-w-20 justify-center text-sm font-semibold" : "min-w-16 justify-center text-xs font-semibold"} aria-live="polite">
        {qty(value, unit)}
      </ButtonGroupText>
      <Button variant="outline" size={iconSize} disabled={disabled || value + step > max} onClick={() => onChange(round(value + step))} aria-label="Aumentar">
        <PlusIcon />
      </Button>
    </ButtonGroup>
  )
}
