"use client"

import { SWRConfig } from "swr"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { fetcher } from "@/lib/api"

export function Providers({ children, theme }: { children: React.ReactNode; theme: "dark" | "light" }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, shouldRetryOnError: false }}>
      <TooltipProvider>
        {children}
        <Toaster theme={theme} position="top-center" richColors closeButton />
      </TooltipProvider>
    </SWRConfig>
  )
}
