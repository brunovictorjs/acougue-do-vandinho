"use client"

import { HouseIcon, LocateFixedIcon, MapPinIcon, SearchIcon, StoreIcon, TruckIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, errorMessage } from "@/lib/api"
import { maskCep, money } from "@/lib/format"
import type { Address, DeliveryQuote } from "@/lib/types"

export interface AddressValues {
  label: string
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  reference: string
  latitude: number | null
  longitude: number | null
  isDefault: boolean
}

export const emptyAddress: AddressValues = {
  label: "Casa",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: "",
  latitude: null,
  longitude: null,
  isDefault: false,
}

export function toValues(a: Address): AddressValues {
  return { ...a, complement: a.complement ?? "", reference: a.reference ?? "" }
}

function DeliveryHint({ neighborhood }: { neighborhood: string }) {
  const [debounced, setDebounced] = React.useState(neighborhood)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(neighborhood.trim()), 400)
    return () => clearTimeout(t)
  }, [neighborhood])
  const { data } = useSWR<DeliveryQuote>(debounced.length > 2 ? `/store/delivery-quote?neighborhood=${encodeURIComponent(debounced)}` : null)
  if (!data) return null
  return (
    <Alert className={data.served ? "border-brand-gold-dark" : undefined}>
      {data.served ? <TruckIcon /> : <StoreIcon />}
      <AlertDescription>
        {data.served ? (
          <span>
            Entregamos em {data.neighborhood} · taxa de <b className="text-gold-text">{money(data.feeCents ?? 0)}</b> · até {data.etaMinutes} min
          </span>
        ) : (
          <span>Ainda não entregamos neste bairro — você pode salvar o endereço e retirar o pedido no balcão.</span>
        )}
      </AlertDescription>
    </Alert>
  )
}

/** Address form shared by onboarding and "Endereços". Fills from CEP (ViaCEP) or the device location. */
export function AddressForm({
  initial = emptyAddress,
  submitLabel,
  onSubmit,
  showDefaultToggle = true,
  secondary,
}: {
  initial?: AddressValues
  submitLabel: string
  onSubmit: (values: AddressValues) => Promise<void>
  showDefaultToggle?: boolean
  secondary?: React.ReactNode
}) {
  const [v, setV] = React.useState<AddressValues>(initial)
  const [busy, setBusy] = React.useState<"cep" | "gps" | "save" | null>(null)
  const set = <K extends keyof AddressValues>(key: K, value: AddressValues[K]) => setV((s) => ({ ...s, [key]: value }))

  async function lookupCep() {
    const cep = v.zipCode.replace(/\D/g, "")
    if (cep.length !== 8) return toast.error("Digite um CEP com 8 números.")
    setBusy("cep")
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = (await res.json()) as { erro?: boolean; logradouro: string; bairro: string; localidade: string; uf: string }
      if (data.erro) throw new Error("CEP não encontrado.")
      setV((s) => ({ ...s, street: data.logradouro || s.street, neighborhood: data.bairro || s.neighborhood, city: data.localidade, state: data.uf, latitude: null, longitude: null }))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  function useLocation() {
    if (!navigator.geolocation) return toast.error("Seu navegador não permite localização.")
    setBusy("gps")
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&addressdetails=1&accept-language=pt-BR`)
          const d = (await res.json()) as { address?: Record<string, string> }
          const a = d.address ?? {}
          setV((s) => ({
            ...s,
            street: a.road ?? s.street,
            number: a.house_number ?? s.number,
            neighborhood: a.suburb ?? a.neighbourhood ?? a.quarter ?? s.neighborhood,
            city: a.city ?? a.town ?? a.village ?? s.city,
            state: (a["ISO3166-2-lvl4"] ?? "").replace("BR-", "") || s.state,
            zipCode: a.postcode ? maskCep(a.postcode) : s.zipCode,
            latitude: coords.latitude,
            longitude: coords.longitude,
          }))
          toast.success("Endereço preenchido pela sua localização. Confira o número.")
        } catch {
          setV((s) => ({ ...s, latitude: coords.latitude, longitude: coords.longitude }))
        } finally {
          setBusy(null)
        }
      },
      () => {
        setBusy(null)
        toast.error("Não conseguimos acessar sua localização.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy("save")
    try {
      await onSubmit(v)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const labels = ["Casa", "Trabalho", "Outro"]

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="cep">CEP</FieldLabel>
          <InputGroup>
            <InputGroupInput id="cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={v.zipCode} onChange={(e) => set("zipCode", maskCep(e.target.value))} onBlur={() => v.zipCode.replace(/\D/g, "").length === 8 && !v.street && lookupCep()} required />
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={lookupCep} disabled={busy === "cep"}>
                {busy === "cep" ? <Spinner /> : <SearchIcon />}
                Buscar
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Button type="button" variant="ghost" className="-mt-2 h-11 self-start px-0 text-gold-text hover:bg-transparent" onClick={useLocation} disabled={busy === "gps"}>
          {busy === "gps" ? <Spinner data-icon="inline-start" /> : <LocateFixedIcon data-icon="inline-start" />}
          Usar minha localização atual
        </Button>
        <Field>
          <FieldLabel htmlFor="street">Rua</FieldLabel>
          <Input id="street" autoComplete="address-line1" value={v.street} onChange={(e) => set("street", e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="number">Número</FieldLabel>
            <Input id="number" value={v.number} onChange={(e) => set("number", e.target.value)} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="complement">Complemento</FieldLabel>
            <Input id="complement" placeholder="Apto, bloco" value={v.complement} onChange={(e) => set("complement", e.target.value)} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="neighborhood">Bairro</FieldLabel>
          <Input id="neighborhood" value={v.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} required />
        </Field>
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <Field>
            <FieldLabel htmlFor="city">Cidade</FieldLabel>
            <Input id="city" autoComplete="address-level2" value={v.city} onChange={(e) => set("city", e.target.value)} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="state">UF</FieldLabel>
            <Input id="state" maxLength={2} value={v.state} onChange={(e) => set("state", e.target.value.toUpperCase())} required />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="reference">Ponto de referência</FieldLabel>
          <Input id="reference" placeholder="Ex.: portão verde" value={v.reference} onChange={(e) => set("reference", e.target.value)} />
        </Field>
        <Field>
          <FieldLabel>Salvar como</FieldLabel>
          <ToggleGroup variant="chip" size="none" value={[labels.includes(v.label) ? v.label : "Outro"]} onValueChange={(x) => x[0] && set("label", x[0])}>
            <ToggleGroupItem value="Casa">
              <HouseIcon /> Casa
            </ToggleGroupItem>
            <ToggleGroupItem value="Trabalho">
              <StoreIcon /> Trabalho
            </ToggleGroupItem>
            <ToggleGroupItem value="Outro">
              <MapPinIcon /> Outro
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
        {showDefaultToggle && (
          <Field orientation="horizontal">
            <FieldLabel htmlFor="default">Definir como endereço principal</FieldLabel>
            <Switch id="default" checked={v.isDefault} onCheckedChange={(c) => set("isDefault", c)} />
          </Field>
        )}
      </FieldGroup>
      <DeliveryHint neighborhood={v.neighborhood} />
      <div className="flex gap-3">
        {secondary}
        <Button type="submit" size="xl" className="flex-1" disabled={busy === "save"}>
          {busy === "save" && <Spinner data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export async function saveAddress(values: AddressValues, id?: string) {
  const body = {
    ...values,
    complement: values.complement || undefined,
    reference: values.reference || undefined,
    latitude: values.latitude ?? undefined,
    longitude: values.longitude ?? undefined,
  }
  return id ? api<Address>(`/me/addresses/${id}`, { method: "PUT", body }) : api<Address>("/me/addresses", { body })
}
