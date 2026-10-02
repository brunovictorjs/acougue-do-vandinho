import { BeefIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Product photo, or a branded placeholder while the shop has no photo for it
 * (photos are uploaded in Admin › Produtos).
 */
export function ProductImage({
  src,
  alt,
  className,
  iconClassName,
  label,
}: {
  src: string | null | undefined
  alt: string
  className?: string
  iconClassName?: string
  label?: string
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served by the API through /api/uploads
      <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />
    )
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 bg-[radial-gradient(120%_90%_at_30%_20%,#2a1d0e_0%,#140e07_55%,#0b0805_100%)] text-brand-gold-dark",
        className
      )}
    >
      <BeefIcon className={cn("size-8 opacity-80", iconClassName)} aria-hidden />
      {label && <span className="label-caps px-2 text-center text-[0.6rem] text-[#9c8b6e]">{label}</span>}
    </div>
  )
}
