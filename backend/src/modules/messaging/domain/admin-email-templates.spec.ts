import { describe, expect, it } from 'vitest';
import type { AddressSnapshot, OrderItemSummary } from '../../../shared/application/integration-events.js';
import { AdminEmails, renderAdminEmail } from './admin-email-templates.js';

const items: OrderItemSummary[] = [
  { productId: 'p1', name: 'Picanha', quantity: 1.5, unit: 'KG', cutOption: 'BIFE', totalCents: 12990 },
  { productId: 'p2', name: 'Linguiça', quantity: 2, unit: 'PACK', cutOption: null, totalCents: 3600 },
];

const address: AddressSnapshot = {
  label: 'Casa',
  zipCode: '01001000',
  street: 'Rua das Flores',
  number: '120',
  complement: 'ap 31',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  reference: null,
};

const parties = { customerName: 'Maria Souza', customerPhone: '5511999998888' };

describe('AdminEmails.paid', () => {
  it('diz no assunto o que a loja precisa fazer com uma entrega', () => {
    const doc = AdminEmails.paid({ ...parties, code: 'VND-1042', method: 'PIX', fulfillment: 'DELIVERY', items, address, feeCents: 900, totalCents: 17490, url: 'https://loja/admin/pedidos' });
    expect(doc.subject).toBe('Pedido VND-1042 pago — preparar e despachar');
    expect(doc.facts.find((f) => f.label === 'Entrega')?.value).toContain('Rua das Flores, 120 — ap 31');
  });

  it('troca endereço por retirada quando o pedido é de balcão', () => {
    const doc = AdminEmails.paid({ ...parties, code: 'VND-1043', method: 'CREDIT_CARD', fulfillment: 'PICKUP', items, address: null, feeCents: 0, totalCents: 16590, url: 'https://loja/admin/pedidos' });
    expect(doc.subject).toContain('separar para retirada');
    expect(doc.facts.find((f) => f.label === 'Entrega')?.value).toBe('Retirada na loja');
  });
});

describe('AdminEmails.failed', () => {
  it('leva o motivo da falha para o assunto', () => {
    const doc = AdminEmails.failed({ ...parties, code: 'VND-1050', courierName: 'João Lima', reason: 'Cliente ausente', url: 'https://loja/admin/entregas' });
    expect(doc.subject).toBe('Pedido VND-1050 NÃO entregue — cliente ausente');
  });
});

describe('AdminEmails.cancelled', () => {
  it('registra "não informado" quando o cancelamento não trouxe motivo', () => {
    const doc = AdminEmails.cancelled({ ...parties, code: 'VND-1051', totalCents: 17490, method: 'PIX', reason: '  ', url: 'https://loja/admin/pedidos' });
    expect(doc.facts.find((f) => f.label === 'Motivo')?.value).toBe('Não informado');
  });
});

describe('renderAdminEmail', () => {
  const doc = AdminEmails.paid({ ...parties, code: 'VND-1042', method: 'PIX', fulfillment: 'DELIVERY', items, address, feeCents: 900, totalCents: 17490, url: 'https://loja/admin/pedidos' });

  it('monta texto puro com os fatos, os itens e o link do painel', () => {
    const { text } = renderAdminEmail(doc, 'Açougue do Vandinho');
    expect(text).toContain('Cliente: Maria Souza');
    expect(text).toContain('Telefone: (11) 99999-8888');
    expect(text).toContain('• Picanha (bife) — 1,5 kg');
    expect(text).toContain('Gerenciar pedidos: https://loja/admin/pedidos');
  });

  it('escapa o que vem do cliente antes de ir para o HTML', () => {
    const hostile = AdminEmails.delivered({ customerName: '<script>alert(1)</script>', customerPhone: null, code: 'VND-1', courierName: null, url: 'https://loja/admin/entregas' });
    const { html } = renderAdminEmail(hostile, 'Açougue do Vandinho');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
