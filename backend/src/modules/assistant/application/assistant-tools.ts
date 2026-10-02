import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { formatBRL } from '../../../shared/domain/text.js';
import { CatalogQueryService, ProductCard } from '../../catalog/application/catalog-query.service.js';
import type { UserContact } from '../../identity/application/user-directory.js';
import { OrdersService } from '../../ordering/application/orders.service.js';
import { DeliveryZonesService } from '../../store/application/delivery-zones.service.js';
import { StoreSettingsService } from '../../store/application/store-settings.service.js';
import { AttendantsService } from '../../support/application/attendants.service.js';

const UNIT: Record<string, string> = { KG: 'kg', UNIT: 'unidade', PACK: 'pacote' };
const ORDER_STATUS: Record<string, string> = { CART: 'No carrinho', PAID: 'Pago', CANCELLED: 'Cancelado' };
const DELIVERY_STATUS: Record<string, string> = {
  AWAITING: 'Aguardando entrega',
  IN_TRANSIT: 'Entregando',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  NOT_DELIVERED: 'Não entregue',
};

export interface ToolContext {
  phone: string;
  customer: UserContact | null;
  /** Set when the attendants list was shared, so the admin can see handoffs. */
  handoff: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
}

/**
 * The only data the assistant can reach. Order tools are scoped server-side
 * to the customer bound to the WhatsApp number — the model never receives
 * anyone else's orders, whatever it is asked.
 */
@Injectable()
export class AssistantTools {
  constructor(
    private readonly catalog: CatalogQueryService,
    private readonly orders: OrdersService,
    private readonly settings: StoreSettingsService,
    private readonly zones: DeliveryZonesService,
    private readonly attendants: AttendantsService,
    private readonly config: AppConfig,
  ) {}

  readonly definitions: ToolDefinition[] = [
    {
      name: 'buscar_produtos',
      description: 'Busca produtos do catálogo por termo (nome do corte, tipo de carne) e/ou categoria. Retorna preço atual, unidade de venda, oferta, disponibilidade e link. Use sempre antes de falar de qualquer produto ou preço.',
      input_schema: {
        type: 'object',
        properties: { termo: { type: 'string', description: 'Ex.: picanha, linguiça, frango. Vazio para listar tudo.' } },
        required: ['termo'],
        additionalProperties: false,
      },
    },
    {
      name: 'ver_ofertas',
      description: 'Lista os produtos com oferta ativa agora, com preço normal, preço promocional e validade.',
      input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
    {
      name: 'informacoes_loja',
      description: 'Endereço, horário de funcionamento, bairros atendidos com taxa e prazo de entrega, formas de pagamento e link da loja.',
      input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
    {
      name: 'meus_pedidos',
      description: 'Lista os pedidos recentes do cliente DESTA conversa (identificado pelo número de WhatsApp), com status do pedido e da entrega.',
      input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
    {
      name: 'consultar_pedido',
      description: 'Consulta um pedido pelo código (ex.: VND-1042). Só retorna dados se o pedido pertencer ao cliente desta conversa.',
      input_schema: {
        type: 'object',
        properties: { codigo: { type: 'string', description: 'Código do pedido, ex.: VND-1042' } },
        required: ['codigo'],
        additionalProperties: false,
      },
    },
    {
      name: 'atendentes_humanos',
      description: 'Lista os atendentes humanos disponíveis (nome completo e telefone). Use quando o cliente quiser falar com uma pessoa.',
      input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
  ];

  async run(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    switch (name) {
      case 'buscar_produtos':
        return this.searchProducts(String(input.termo ?? ''));
      case 'ver_ofertas':
        return this.offers();
      case 'informacoes_loja':
        return this.storeInfo();
      case 'meus_pedidos':
        return this.myOrders(ctx);
      case 'consultar_pedido':
        return this.order(String(input.codigo ?? ''), ctx);
      case 'atendentes_humanos':
        ctx.handoff = true;
        return this.humans();
      default:
        return JSON.stringify({ erro: `Ferramenta desconhecida: ${name}` });
    }
  }

  private product(c: ProductCard) {
    return {
      nome: c.name,
      categoria: c.category.name,
      preco: `${formatBRL(c.priceCents)} por ${UNIT[c.unit]}`,
      ...(c.offer ? { oferta: `${c.offer.discountPercent}% off (de ${formatBRL(c.listPriceCents)})`, oferta_valida_ate: c.offer.endsAt?.toLocaleDateString('pt-BR') ?? 'sem data de fim' } : {}),
      disponivel: c.available,
      opcoes_de_corte: c.cutOptions,
      avaliacao: c.ratingCount ? `${c.ratingAvg.toFixed(1)} (${c.ratingCount} avaliações)` : 'sem avaliações',
      descricao: c.shortDescription,
      link: `${this.config.frontendUrl}/produto/${c.slug}`,
    };
  }

  async searchProducts(term: string) {
    const res = await this.catalog.list({ search: term || undefined, pageSize: 10 });
    if (!res.items.length) return JSON.stringify({ resultado: 'Nenhum produto encontrado com esse termo.', link_catalogo: this.config.frontendUrl });
    return JSON.stringify({ produtos: res.items.map((c) => this.product(c)), total_encontrado: res.total });
  }

  async offers() {
    const res = await this.catalog.list({ offersOnly: true, pageSize: 20 });
    return JSON.stringify({ ofertas: res.items.map((c) => this.product(c)) });
  }

  async storeInfo() {
    const [s, zones] = await Promise.all([this.settings.publicInfo(), this.zones.list()]);
    return JSON.stringify({
      nome: s.name,
      endereco: s.addressLine || 'não informado',
      horarios: s.hours,
      entrega: zones.filter((z) => z.active).map((z) => ({ bairro: z.neighborhood, taxa: formatBRL(z.feeCents), prazo: `até ${z.etaMinutes} min` })),
      retirada: 'Grátis, no balcão da loja, com o código do pedido.',
      pagamento: 'Pix, cartão de crédito e cartão de débito, pelo site.',
      link_loja: this.config.frontendUrl,
      link_pedidos: `${this.config.frontendUrl}/pedidos`,
    });
  }

  private orderView(o: Awaited<ReturnType<OrdersService['recentForCustomer']>>[number]) {
    return {
      codigo: o.code,
      status: ORDER_STATUS[o.status],
      entrega: o.fulfillment === 'PICKUP' ? (o.pickedUpAt ? 'Retirado na loja' : 'Aguardando retirada na loja') : (o.deliveryStatus ? DELIVERY_STATUS[o.deliveryStatus] : '—'),
      total: formatBRL(o.totalCents),
      data: o.createdAt.toLocaleString('pt-BR'),
      itens: o.items.map((i) => `${i.productName} (${i.quantity} ${UNIT[i.unit]})`),
    };
  }

  async myOrders(ctx: ToolContext) {
    if (!ctx.customer) {
      return JSON.stringify({ resultado: 'Este número de WhatsApp não está vinculado a nenhuma conta. O cliente precisa se cadastrar no site com este número para consultar pedidos.', link: this.config.frontendUrl });
    }
    const list = await this.orders.recentForCustomer(ctx.customer.id);
    if (!list.length) return JSON.stringify({ resultado: 'Nenhum pedido encontrado para este cliente.' });
    return JSON.stringify({ cliente: ctx.customer.firstName, pedidos: list.map((o) => this.orderView(o)) });
  }

  async order(code: string, ctx: ToolContext) {
    const normalized = code.trim().toUpperCase().replace(/^#/, '');
    const denied = JSON.stringify({ resultado: 'Pedido não vinculado a este número. Não compartilhe nenhuma informação sobre ele.' });
    if (!ctx.customer) return denied;
    const owner = await this.orders.findCodeOwner(normalized);
    if (owner !== ctx.customer.id) return denied;
    const list = await this.orders.recentForCustomer(ctx.customer.id, 50);
    const found = list.find((o) => o.code === normalized);
    return found ? JSON.stringify(this.orderView(found)) : JSON.stringify({ resultado: 'Esse pedido ainda está no carrinho (não foi pago).' });
  }

  async humans() {
    const list = await this.attendants.active();
    if (!list.length) return JSON.stringify({ resultado: 'Nenhum atendente disponível cadastrado no momento.' });
    return JSON.stringify({ atendentes: list.map((a) => ({ nome: a.fullName, telefone: a.phoneFormatted })) });
  }
}
