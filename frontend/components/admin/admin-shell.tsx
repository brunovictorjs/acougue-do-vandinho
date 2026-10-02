"use client"

import {
  BikeIcon,
  BotIcon,
  ChartColumnIcon,
  ExternalLinkIcon,
  HeadsetIcon,
  LogOutIcon,
  MapPinIcon,
  PackageIcon,
  ReceiptTextIcon,
  Settings2Icon,
  StarIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { Logo } from "@/components/brand"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { logout, useSession } from "@/hooks/use-session"
import { initials } from "@/lib/format"
import type { Role } from "@/lib/types"

/** `staff` items are also open to employees (EMPLOYEE); the rest is admin-only. */
const NAV: Array<{ group: string | null; items: Array<{ href: string; label: string; icon: React.ComponentType; staff?: boolean }> }> = [
  { group: null, items: [{ href: "/admin", label: "Visão geral", icon: ChartColumnIcon }] },
  {
    group: "Vendas",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: ReceiptTextIcon, staff: true },
      { href: "/admin/entregas", label: "Entregas", icon: TruckIcon },
      { href: "/admin/entregadores", label: "Entregadores", icon: BikeIcon },
    ],
  },
  {
    group: "Catálogo",
    items: [
      { href: "/admin/produtos", label: "Produtos", icon: PackageIcon, staff: true },
      { href: "/admin/ofertas", label: "Ofertas", icon: TagIcon, staff: true },
      { href: "/admin/avaliacoes", label: "Avaliações", icon: StarIcon, staff: true },
    ],
  },
  {
    group: "Pessoas",
    items: [
      { href: "/admin/usuarios", label: "Usuários e papéis", icon: UsersIcon },
      { href: "/admin/atendentes", label: "Atendentes", icon: HeadsetIcon },
      { href: "/admin/enderecos", label: "Endereços", icon: MapPinIcon },
    ],
  },
  { group: "Canais", items: [{ href: "/admin/atendente-ia", label: "Atendente IA", icon: BotIcon }] },
  { group: "Loja", items: [{ href: "/admin/configuracoes", label: "Configurações", icon: Settings2Icon }] },
]

const isActive = (href: string, pathname: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href))

/** Whether this role may open an admin path. */
export function canOpenAdmin(role: Role | undefined, pathname: string) {
  if (role === "ADMIN") return true
  if (role !== "EMPLOYEE") return false
  return NAV.some((g) => g.items.some((i) => i.staff && isActive(i.href, pathname)))
}

/** First screen of the back office for this role. */
export const adminHome = (role: Role) => (role === "EMPLOYEE" ? "/admin/pedidos" : "/admin")

function AppSidebar() {
  const pathname = usePathname()
  const { me } = useSession()
  /** Neighborhoods with customers but no active delivery zone. */
  const { data: pending } = useSWR<{ count: number }>(me?.role === "ADMIN" ? "/admin/addresses/pending" : null)
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => me?.role === "ADMIN" || i.staff) })).filter((g) => g.items.length)
  return (
    <Sidebar className="dark">
      <SidebarHeader>
        <Link href={me ? adminHome(me.role) : "/admin"} className="flex items-center gap-3 px-1 py-1.5">
          <Logo size={44} />
          <span className="flex flex-col">
            <span className="font-heading text-sm font-semibold tracking-wider text-foreground uppercase">Vandinho</span>
            <span className="text-xs text-muted-foreground">Painel administrativo</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {nav.map(({ group, items }) => (
          <SidebarGroup key={group ?? "main"}>
            {group && <SidebarGroupLabel className="label-caps">{group}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href, pathname)
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={active}
                        render={<Link href={href} />}
                        className="h-10 data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground"
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      {href === "/admin/enderecos" && !!pending?.count && (
                        <SidebarMenuBadge className="bg-orange text-white" aria-label={`${pending.count} bairros sem atendimento`}>
                          {pending.count}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<a href="/" target="_blank" rel="noreferrer" />} className="h-10">
              <ExternalLinkIcon />
              <span>Ver loja</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-3 border-t border-sidebar-border px-1 pt-3">
          <Avatar className="size-9">
            {me?.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
            <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{initials(`${me?.firstName ?? ""} ${me?.lastName ?? ""}`)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{me?.firstName}</span>
            <span className="text-xs text-muted-foreground">{me?.role === "EMPLOYEE" ? "Funcionário" : "Administrador"}</span>
          </span>
          <Button variant="ghost" size="icon" aria-label="Sair" onClick={() => void logout()}>
            <LogOutIcon />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <SidebarTrigger aria-label="Abrir menu" />
          <span className="font-heading text-sm font-semibold tracking-wider uppercase">Painel Vandinho</span>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

/** Page header used by every admin screen. */
export function AdminPage({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b px-4 py-5 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-3xl md:text-4xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8">{children}</div>
    </main>
  )
}
