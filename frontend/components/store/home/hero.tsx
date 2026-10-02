"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ArrowRightIcon, MessageCircleIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import * as React from "react"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP)

export function Hero({ whatsapp }: { whatsapp: string }) {
  const ref = React.useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } })
        tl.fromTo("[data-hero-seal]", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5 })
          .fromTo("[data-hero-line]", { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.09 }, "-=0.2")
          .fromTo("[data-hero-copy]", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.5")
          .fromTo("[data-hero-cta]", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, "-=0.4")
          .fromTo("[data-hero-emblem]", { autoAlpha: 0, scale: 0.85, rotate: -8 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: 1.1, ease: "expo.out" }, 0.2)
        gsap.to("[data-hero-glow]", { opacity: 0.55, scale: 1.08, duration: 3.2, yoyo: true, repeat: -1, ease: "sine.inOut" })
      })
      return () => mm.revert()
    },
    { scope: ref }
  )

  const lines = [
    ["Corte", ""],
    ["na hora,", ""],
    ["direto pra", "text-brand-gold"],
    ["sua mesa.", "text-brand-gold"],
  ]

  return (
    <section ref={ref} className="relative isolate overflow-hidden border-b">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_80%_30%,rgba(229,169,0,0.12),transparent_70%)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-10 pb-12 md:grid-cols-[1.1fr_0.9fr] md:pt-16 md:pb-20">
        <div className="flex flex-col gap-5">
          <Badge data-hero-seal variant="outline" className="h-7 rounded-sm border-brand-gold-dark bg-black px-3 font-heading tracking-[0.14em] text-gold-text uppercase">
            Carne fresca todo dia
          </Badge>
          <h1 className="font-display text-[3.6rem] leading-[0.95] sm:text-7xl md:text-[5.5rem]">
            {lines.map(([text, cls]) => (
              <span key={text} className="block overflow-hidden pb-1">
                <span data-hero-line className={cn("block", cls)}>
                  {text}
                </span>
              </span>
            ))}
          </h1>
          <p data-hero-copy className="max-w-md text-base text-muted-foreground md:text-lg">
            Escolha o corte e o peso, pague no Pix ou no cartão e receba em casa — ou retire no balcão.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link data-hero-cta href="#catalogo" className={cn(buttonVariants({ size: "xl" }), "w-full sm:w-auto")}>
              Ver catálogo
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
            {whatsapp && (
              <a
                data-hero-cta
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ size: "xl", variant: "outline" }), "w-full border-brand-gold sm:w-auto")}
              >
                <MessageCircleIcon data-icon="inline-start" />
                Tirar dúvidas no WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="relative mx-auto hidden aspect-square w-full max-w-md md:block">
          <div data-hero-glow aria-hidden className="absolute inset-[8%] rounded-full bg-brand-gold opacity-25 blur-3xl" />
          <Image data-hero-emblem src="/logo.png" alt="" fill sizes="28rem" priority className="relative object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" />
        </div>
      </div>
    </section>
  )
}
