"use client"

import { CalendarRangeIcon, XIcon } from "lucide-react"
import * as React from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** Calendar days as "YYYY-MM-DD"; either end may be open. */
export interface Period {
  from?: string
  to?: string
}

const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const label = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(2, 4)}`

export function periodLabel(p: Period) {
  if (p.from && p.to) return p.from === p.to ? label(p.from) : `${label(p.from)} – ${label(p.to)}`
  if (p.from) return `Desde ${label(p.from)}`
  if (p.to) return `Até ${label(p.to)}`
  return null
}

/** Appends `from`/`to` to a query string builder. */
export function withPeriod(qs: URLSearchParams, p: Period) {
  if (p.from) qs.set("from", p.from)
  if (p.to) qs.set("to", p.to)
  return qs
}

/** "Período" button that opens a start/end date picker. */
export function PeriodFilter({ value, onChange, className, requireBoth = false }: { value: Period; onChange: (p: Period) => void; className?: string; requireBoth?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<Period>(value)
  const current = periodLabel(value)
  const today = toDay(new Date())
  const invalid = !!draft.from && !!draft.to && draft.from > draft.to
  const incomplete = requireBoth ? !draft.from || !draft.to : !draft.from && !draft.to

  return (
    <div className={cn("flex items-center", className)}>
      <Popover
        open={open}
        onOpenChange={(o) => {
          if (o) setDraft(value)
          setOpen(o)
        }}
      >
        <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "bg-card", current && "border-brand-gold-dark text-gold-text", current && "rounded-r-none")}>
          <CalendarRangeIcon data-icon="inline-start" />
          {current ?? "Período"}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 gap-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="period-from">Data início</FieldLabel>
              <Input id="period-from" type="date" max={draft.to || today} value={draft.from ?? ""} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value || undefined }))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="period-to">Data fim</FieldLabel>
              <Input id="period-to" type="date" min={draft.from} max={today} value={draft.to ?? ""} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value || undefined }))} />
            </Field>
          </div>
          {invalid && <p className="text-xs text-destructive">A data início deve ser anterior à data fim.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={invalid || incomplete}
              onClick={() => {
                onChange(draft)
                setOpen(false)
              }}
            >
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {current && (
        <Button variant="outline" size="icon" className="rounded-l-none border-l-0 border-brand-gold-dark bg-card" aria-label="Limpar período" onClick={() => onChange({})}>
          <XIcon />
        </Button>
      )}
    </div>
  )
}
