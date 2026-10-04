import type { Metadata } from "next"
import { LegalPage } from "@/components/store/legal-page"

export const metadata: Metadata = {
  title: "Termos de Serviço",
  description: "Condições de uso da loja online: conta, pedidos, pagamento, entrega, cancelamento e devolução.",
}

export default function TermsPage() {
  return <LegalPage doc="terms" title="Termos de Serviço" />
}
