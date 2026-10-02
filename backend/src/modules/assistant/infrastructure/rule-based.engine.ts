import { Injectable } from '@nestjs/common';
import { normalizeName } from '../../../shared/domain/text.js';
import { AssistantTools, ToolContext } from '../application/assistant-tools.js';

type Json = Record<string, unknown>;

/**
 * Offline fallback used when no ANTHROPIC_API_KEY is configured, so the
 * WhatsApp flow can be tested end to end. It answers with the same tools and
 * the same privacy rules, just without language understanding.
 */
@Injectable()
export class RuleBasedEngine {
  constructor(private readonly tools: AssistantTools) {}

  async reply(text: string, ctx: ToolContext): Promise<string> {
    const t = normalizeName(text);
    const code = text.toUpperCase().match(/VND-?\s?(\d{3,6})/);

    if (/(atendente|humano|pessoa|falar com alguem|gerente)/.test(t)) {
      const r = JSON.parse(await this.tools.run('atendentes_humanos', {}, ctx)) as Json;
      const list = (r.atendentes as Array<{ nome: string; telefone: string }> | undefined) ?? [];
      if (!list.length) return 'No momento não há atendentes disponíveis. Tente novamente mais tarde, por favor.';
      return `Claro! Estes são nossos atendentes, é só chamar um deles:\n\n${list.map((a) => `*${a.nome}* · ${a.telefone}`).join('\n')}`;
    }

    if (code) {
      const r = JSON.parse(await this.tools.run('consultar_pedido', { codigo: `VND-${code[1]}` }, ctx)) as Json;
      if (r.codigo) return `O pedido *${String(r.codigo)}* está *${String(r.status)}* · entrega: ${String(r.entrega)}. Total ${String(r.total)}.`;
      return 'Esse pedido não está vinculado a este número, então não posso passar informações sobre ele.';
    }

    if (/(pedido|entrega|chegando|status|compra)/.test(t)) {
      const r = JSON.parse(await this.tools.run('meus_pedidos', {}, ctx)) as Json;
      const list = (r.pedidos as Array<Json> | undefined) ?? [];
      if (!list.length) return String(r.resultado ?? 'Não encontrei pedidos para este número.');
      return `Seus pedidos recentes:\n\n${list
        .slice(0, 3)
        .map((o) => `*${String(o.codigo)}* · ${String(o.status)} · ${String(o.entrega)} · ${String(o.total)}`)
        .join('\n')}`;
    }

    if (/(oferta|promo|desconto)/.test(t)) {
      const r = JSON.parse(await this.tools.run('ver_ofertas', {}, ctx)) as Json;
      const list = (r.ofertas as Array<Json> | undefined) ?? [];
      if (!list.length) return 'Hoje não temos ofertas ativas, mas o catálogo completo está no site.';
      return `Ofertas de hoje:\n\n${list.map((p) => `*${String(p.nome)}* — ${String(p.preco)} (${String(p.oferta)})`).join('\n')}`;
    }

    if (/(horario|abre|fecha|endereco|onde fica|localizacao|taxa|bairro|entregam)/.test(t)) {
      const r = JSON.parse(await this.tools.run('informacoes_loja', {}, ctx)) as Json;
      const hours = (r.horarios as Array<{ label: string; value: string }>).map((h) => `${h.label}: ${h.value}`).join('\n');
      const zones = (r.entrega as Array<Json>).map((z) => `${String(z.bairro)} (${String(z.taxa)})`).join(', ');
      return `*${String(r.nome)}*\n${String(r.endereco)}\n\n${hours}\n\nEntregamos em: ${zones || 'consulte a loja'}.`;
    }

    const words = t.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    for (const w of words) {
      const r = JSON.parse(await this.tools.run('buscar_produtos', { termo: w }, ctx)) as Json;
      const list = (r.produtos as Array<Json> | undefined) ?? [];
      if (list.length) {
        return list
          .slice(0, 3)
          .map((p) => `*${String(p.nome)}* — ${String(p.preco)}${p.oferta ? ` (${String(p.oferta)})` : ''}${p.disponivel ? '' : ' · indisponível'}\n${String(p.link)}`)
          .join('\n\n');
      }
    }

    return 'Oi! Sou o atendente virtual do Açougue do Vandinho (modo de teste). Posso ajudar com *produtos e preços*, *ofertas*, *horário e entrega* ou *seus pedidos*. Se quiser falar com uma pessoa, é só pedir.';
  }
}
