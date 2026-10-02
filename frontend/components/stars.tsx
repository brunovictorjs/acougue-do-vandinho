import { StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function Stars({ value, className, size = "size-3.5" }: { value: number; className?: string; size?: string }) {
  const rounded = Math.round(value)
  return (
    <span className={cn("inline-flex gap-0.5", className)} role="img" aria-label={`${value.toLocaleString("pt-BR")} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          aria-hidden
          className={cn(size, n <= rounded ? "fill-brand-gold text-brand-gold" : "fill-transparent text-muted-foreground/40")}
        />
      ))}
    </span>
  )
}
