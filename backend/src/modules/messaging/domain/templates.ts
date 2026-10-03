import type { AddressSnapshot, OrderItemSummary, PaymentMethodKind } from '../../../shared/application/integration-events.js';
import { formatBRL, formatQuantity } from '../../../shared/domain/text.js';

/** WhatsApp message copy. WhatsApp renders *text* as bold. */
export const METHOD_LABEL: Record<PaymentMethodKind, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'cartão de crédito',
  DEBIT_CARD: 'cartão de débito',
};

const itemLines = (items: OrderItemSummary[]) =>
  items.map((i) => `• ${i.name}${i.cutOption ? ` (${i.cutOption.toLowerCase()})` : ''} — ${formatQuantity(i.quantity, i.unit)}`).join('\n');

export const Templates = {
  phoneCode: (code: string) =>
    `Seu código de verificação do *Açougue do Vandinho* é *${code}*.\nEle vale por 10 minutos. Se você não pediu, ignore esta mensagem.`,

  welcome: (firstName: string, storeUrl: string) =>
    `Olá, ${firstName}! Seu cadastro no *Açougue do Vandinho* está completo.\n\nPor aqui você recebe as atualizações dos seus pedidos e pode tirar dúvidas sobre cortes, preços e ofertas com o nosso atendente virtual.\n\nLoja: ${storeUrl}`,

  paidDelivery: (p: { code: string; method: PaymentMethodKind; items: OrderItemSummary[]; address: AddressSnapshot; feeCents: number; totalCents: number; link: string }) =>
    `*Pedido ${p.code} confirmado!*\nPagamento via ${METHOD_LABEL[p.method]} aprovado.\n\nItens:\n${itemLines(p.items)}\n\nEntrega: ${p.address.street}, ${p.address.number}${p.address.complement ? ` — ${p.address.complement}` : ''} · ${p.address.neighborhood}\nTaxa de entrega: ${formatBRL(p.feeCents)}\nTotal: *${formatBRL(p.totalCents)}*\n\nVocê recebe aqui cada atualização. Acompanhe também: ${p.link}`,

  paidPickup: (p: { code: string; method: PaymentMethodKind; items: OrderItemSummary[]; totalCents: number; storeAddress: string; hours: string; link: string }) =>
    `*Pedido ${p.code} confirmado — retirada na loja*\nPagamento via ${METHOD_LABEL[p.method]} aprovado.\n\nItens:\n${itemLines(p.items)}\n\nTotal pago: *${formatBRL(p.totalCents)}*\n\n*Código de retirada: ${p.code}*\nMostre este código no balcão.\n\nRetire em: ${p.storeAddress || 'nossa loja'}${p.hours ? `\nHorário: ${p.hours}` : ''}\n\nDetalhes: ${p.link}`,

  started: (code: string, courier: string | null, deliveryCode: string) =>
    `*Seu pedido ${code} saiu para entrega!*\n${courier ? `${courier.split(' ')[0]} está` : 'Nosso entregador está'} a caminho. Fique de olho no interfone.\n\n*Código de entrega: ${deliveryCode}*\nInforme este código ao entregador para receber o pedido. Sem ele, a entrega não é concluída — não passe o código para mais ninguém.`,

  delivered: (code: string, link: string) =>
    `*Pedido ${code} entregue.* Bom apetite!\nSe puder, conte o que achou dos produtos: ${link}`,

  pickedUp: (code: string, link: string) =>
    `*Pedido ${code} retirado na loja.* Bom apetite!
Se puder, conte o que achou dos produtos: ${link}`,

  failed: (code: string, reason: string) =>
    `*Não conseguimos entregar o pedido ${code}.*\nMotivo: ${reason.toLowerCase()}.\nResponda aqui ou peça para falar com um atendente e combinamos uma nova entrega.`,

  rescheduled: (code: string) => `*Nova tentativa de entrega do pedido ${code}.* Assim que sair para entrega, eu aviso aqui.`,

  cancelled: (code: string, totalCents: number, method: PaymentMethodKind | null) =>
    `*Pedido ${code} cancelado.*\nReembolso de *${formatBRL(totalCents)}* iniciado${method ? ` via ${METHOD_LABEL[method]}` : ''}. ${
      method === 'PIX' ? 'O valor volta para a conta de origem.' : 'O estorno aparece na fatura do cartão em alguns dias úteis.'
    }\nTe aviso quando concluir.`,

  refunded: (code: string, amountCents: number) => `*Reembolso concluído.* ${formatBRL(amountCents)} do pedido ${code} foram devolvidos.`,
};
