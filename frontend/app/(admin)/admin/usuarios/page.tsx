"use client"

import { InfoIcon, SearchIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import * as React from "react"
import { Suspense } from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { ListPagination, type Paged } from "@/components/list-pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { initials, phone, shortDate } from "@/lib/format"
import type { Role } from "@/lib/types"

type User = { id: string; fullName: string; email: string; phone: string | null; phoneVerified: boolean; avatarUrl: string | null; role: Role; paidOrders: number; onboardingComplete: boolean; createdAt: string }
type Data = Paged<User> & { counts: Partial<Record<Role, number>> }

const ROLES = [
  { value: "CUSTOMER", label: "Cliente" },
  { value: "COURIER", label: "Entregador" },
  { value: "EMPLOYEE", label: "Funcionário" },
  { value: "ADMIN", label: "Administrador" },
]

function UsersContent() {
  const params = useSearchParams()
  const { me } = useSession()
  const [tab, setTab] = React.useState<string>(params.get("papel") ?? "all")
  const [search, setSearch] = React.useState("")
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const qs = new URLSearchParams({ page: String(page) })
  if (tab !== "all") qs.set("role", tab)
  if (q) qs.set("search", q)
  const { data, mutate } = useSWR<Data>(`/admin/users?${qs}`, { keepPreviousData: true })
  const total = data ? Object.values(data.counts).reduce((s, n) => s + (n ?? 0), 0) : 0

  async function changeRole(u: User, role: Role) {
    try {
      await api(`/admin/users/${u.id}/role`, { method: "PATCH", body: { role } })
      toast.success(`${u.fullName} agora é ${ROLES.find((r) => r.value === role)?.label.toLowerCase()}.`)
      void mutate()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <AdminPage title="Usuários e papéis" description="Clientes, entregadores, funcionários e administradores. Funcionários acessam pedidos e catálogo.">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(String(v))
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="all">Todos · {total}</TabsTrigger>
          <TabsTrigger value="CUSTOMER">Clientes · {data?.counts.CUSTOMER ?? 0}</TabsTrigger>
          <TabsTrigger value="COURIER">Entregadores · {data?.counts.COURIER ?? 0}</TabsTrigger>
          <TabsTrigger value="EMPLOYEE">Funcionários · {data?.counts.EMPLOYEE ?? 0}</TabsTrigger>
          <TabsTrigger value="ADMIN">Admins · {data?.counts.ADMIN ?? 0}</TabsTrigger>
        </TabsList>
      </Tabs>
      <InputGroup className="w-full max-w-sm bg-card">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput aria-label="Buscar usuários" placeholder="Nome, e-mail ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </InputGroup>
      <Card className="py-0">
        {!data ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Usuário</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Pedidos pagos</TableHead>
                <TableHead className="pr-4">Desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
              {data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-4">
                    <span className="flex items-center gap-3">
                      <Avatar className="size-9">
                        {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt="" />}
                        <AvatarFallback className="bg-secondary text-xs text-gold-text">{initials(u.fullName)}</AvatarFallback>
                      </Avatar>
                      <span className="flex flex-col">
                        <span className="font-semibold">{u.fullName}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>{u.phone ? phone(u.phone) : <Badge className="bg-orange/15 text-orange">Cadastro incompleto</Badge>}</TableCell>
                  <TableCell>
                    <Select items={ROLES} value={u.role} onValueChange={(v) => v && v !== u.role && void changeRole(u, v as Role)} disabled={u.id === me?.id}>
                      <SelectTrigger className="h-9 min-w-36" aria-label={`Papel de ${u.fullName}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{u.paidOrders}</TableCell>
                  <TableCell className="pr-4">{shortDate(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {data && <ListPagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      <Alert>
        <InfoIcon />
        <AlertDescription>Todo mundo entra com Google. Para criar um entregador ou administrador, peça para a pessoa entrar uma vez e troque o papel aqui. E-mails em ADMIN_EMAILS viram administradores automaticamente.</AlertDescription>
      </Alert>
    </AdminPage>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense>
      <UsersContent />
    </Suspense>
  )
}
