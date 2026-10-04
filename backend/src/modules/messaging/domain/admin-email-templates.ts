import type { AddressSnapshot, OrderItemSummary, PaymentMethodKind } from '../../../shared/application/integration-events.js';
import { formatBRL, formatPhone, formatQuantity } from '../../../shared/domain/text.js';
import { METHOD_LABEL } from './templates.js';

/** Aviso pronto para enviar, antes de virar texto e HTML. */
export interface AdminEmailDoc {
  subject: string;
  title: string;
  /** Uma linha dizendo o que aconteceu e o que a administração precisa fazer. */
  summary: string;
  facts: Array<{ label: string; value: string }>;
  items?: OrderItemSummary[];
  /** Para onde o admin vai resolver isso. */
  action: { label: string; url: string };
}

export interface OrderPartiesInfo {
  customerName: string;
  customerPhone: string | null;
}

const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const contactFacts = (p: OrderPartiesInfo) => [
  { label: 'Cliente', value: p.customerName },
  ...(p.customerPhone ? [{ label: 'Telefone', value: formatPhone(p.customerPhone) }] : []),
];

const addressLine = (a: AddressSnapshot) =>
  `${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ''} · ${a.neighborhood} · ${a.city}/${a.state}`;

/**
 * Textos dos avisos para a administração. Diferente das mensagens do cliente,
 * cada um abre com o que mudou e termina no link do painel: quem lê está
 * decidindo se precisa agir agora.
 */
export const AdminEmails = {
  paid: (p: OrderPartiesInfo & { code: string; method: PaymentMethodKind; fulfillment: 'DELIVERY' | 'PICKUP'; items: OrderItemSummary[]; address: AddressSnapshot | null; feeCents: number; totalCents: number; url: string }): AdminEmailDoc => ({
    subject: `Pedido ${p.code} pago — ${p.fulfillment === 'DELIVERY' ? 'preparar e despachar' : 'separar para retirada'}`,
    title: `Pedido ${p.code} pago`,
    summary:
      p.fulfillment === 'DELIVERY'
        ? 'O pagamento foi aprovado. Separe os itens e designe um entregador no painel.'
        : 'O pagamento foi aprovado. Separe os itens — o cliente vai retirar na loja com o código do pedido.',
    facts: [
      ...contactFacts(p),
      { label: 'Pagamento', value: `${METHOD_LABEL[p.method]} · ${formatBRL(p.totalCents)}` },
      { label: 'Entrega', value: p.address ? `${addressLine(p.address)} (taxa ${formatBRL(p.feeCents)})` : 'Retirada na loja' },
    ],
    items: p.items,
    action: { label: 'Gerenciar pedidos', url: p.url },
  }),

  cancelled: (p: OrderPartiesInfo & { code: string; totalCents: number; method: PaymentMethodKind | null; reason: string | null; url: string }): AdminEmailDoc => ({
    subject: `Pedido ${p.code} cancelado — reembolso de ${formatBRL(p.totalCents)}`,
    title: `Pedido ${p.code} cancelado`,
    summary: 'O reembolso foi iniciado. Confira no painel se ele concluiu e interrompa a separação dos itens.',
    facts: [
      ...contactFacts(p),
      { label: 'Reembolso', value: `${formatBRL(p.totalCents)}${p.method ? ` via ${METHOD_LABEL[p.method]}` : ''}` },
      { label: 'Motivo', value: p.reason?.trim() || 'Não informado' },
    ],
    action: { label: 'Ver pedido', url: p.url },
  }),

  delivered: (p: OrderPartiesInfo & { code: string; courierName: string | null; url: string }): AdminEmailDoc => ({
    subject: `Pedido ${p.code} entregue`,
    title: `Pedido ${p.code} entregue`,
    summary: 'A entrega foi concluída. Nada a fazer além de conferir o acerto do entregador.',
    facts: [...contactFacts(p), { label: 'Entregador', value: p.courierName ?? 'Não informado' }],
    action: { label: 'Ver entregas', url: p.url },
  }),

  pickedUp: (p: OrderPartiesInfo & { code: string; url: string }): AdminEmailDoc => ({
    subject: `Pedido ${p.code} retirado na loja`,
    title: `Pedido ${p.code} retirado na loja`,
    summary: 'O cliente retirou o pedido no balcão. O pedido está encerrado.',
    facts: contactFacts(p),
    action: { label: 'Ver pedido', url: p.url },
  }),

  failed: (p: OrderPartiesInfo & { code: string; courierName: string | null; reason: string; url: string }): AdminEmailDoc => ({
    subject: `Pedido ${p.code} NÃO entregue — ${p.reason.toLowerCase()}`,
    title: `Pedido ${p.code} não foi entregue`,
    summary: 'A entrega falhou e o cliente está esperando uma definição. Combine nova tentativa ou cancele com reembolso.',
    facts: [
      ...contactFacts(p),
      { label: 'Motivo', value: p.reason },
      { label: 'Entregador', value: p.courierName ?? 'Não informado' },
    ],
    action: { label: 'Reagendar ou cancelar', url: p.url },
  }),
};

/** O mesmo aviso em texto puro e em HTML — todo e-mail sai com as duas versões. */
export function renderAdminEmail(doc: AdminEmailDoc, storeName: string): { subject: string; text: string; html: string } {
  const itemLines =
    doc.items?.map((i) => `${i.name}${i.cutOption ? ` (${i.cutOption.toLowerCase()})` : ''} — ${formatQuantity(i.quantity, i.unit)} · ${formatBRL(i.totalCents)}`) ?? [];

  const text = [
    doc.title.toUpperCase(),
    '',
    doc.summary,
    '',
    ...doc.facts.map((f) => `${f.label}: ${f.value}`),
    ...(itemLines.length ? ['', 'Itens:', ...itemLines.map((l) => `• ${l}`)] : []),
    '',
    `${doc.action.label}: ${doc.action.url}`,
    '',
    `— ${storeName} · aviso automático para a administração`,
  ].join('\n');

  const facts = doc.facts
    .map(
      (f) =>
        `<tr><td style="padding:6px 0;color:#71717a;white-space:nowrap;vertical-align:top">${escape(f.label)}</td><td style="padding:6px 0 6px 16px;text-align:right">${escape(f.value)}</td></tr>`,
    )
    .join('');

  const items = itemLines.length
    ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e4e4e7"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#71717a;margin-bottom:8px">Itens</div><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6">${itemLines.map((l) => `<li>${escape(l)}</li>`).join('')}</ul></div>`
    : '';

  const html = `<div style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#18181b;color:#fafafa">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#d4a24a">${escape(storeName)}</div>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:600">${escape(doc.title)}</h1>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escape(doc.summary)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse">${facts}</table>
      ${items}
      <p style="margin:24px 0 0"><a href="${escape(doc.action.url)}" style="display:inline-block;padding:11px 20px;background:#18181b;color:#fafafa;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">${escape(doc.action.label)}</a></p>
    </div>
    <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a">
      Aviso automático para a administração. Para parar de receber, desligue em Atendente IA › Avisos por e-mail.
    </div>
  </div>
</div>`;

  return { subject: doc.subject, text, html };
}
