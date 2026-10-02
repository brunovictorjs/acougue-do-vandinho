import Image from "next/image"
import { cn } from "@/lib/utils"

export function Logo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Açougue do Vandinho"
      width={size}
      height={size}
      priority
      className={cn("shrink-0 rounded-full", className)}
    />
  )
}
