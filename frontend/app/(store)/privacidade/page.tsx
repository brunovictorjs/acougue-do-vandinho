import type { Metadata } from "next"
import { LegalPage } from "@/components/store/legal-page"

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como coletamos, usamos e protegemos os dados pessoais de quem compra na nossa loja online.",
}

export default function PrivacyPage() {
  return <LegalPage doc="privacy" title="Política de Privacidade" />
}
