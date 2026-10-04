import { Injectable, Logger } from '@nestjs/common';
import { UserDirectory } from '../../identity/application/user-directory.js';
import { StoreSettingsService } from '../../store/application/store-settings.service.js';
import type { AdminEmailNotification } from '../../store/domain/admin-email-notifications.js';
import { AdminEmailDoc, renderAdminEmail } from '../domain/admin-email-templates.js';
import { EmailGateway } from '../domain/email-gateway.js';

/** Quanto tempo uma chave de envio continua barrando repetição. */
const DEDUPE_TTL_MS = 10 * 60 * 1000;

/**
 * Envia os avisos de pedido para quem administra a loja. Os destinatários são
 * sempre resolvidos aqui — os e-mails dos usuários com papel ADMIN, mais os de
 * ADMIN_EMAILS — e nunca vêm do evento, para um aviso não poder ser desviado
 * por dado de pedido.
 *
 * O envio é direto no gateway (são poucos endereços, sem limite de taxa a
 * respeitar como no WhatsApp). Uma falha é registrada no log e o aviso é
 * perdido: o painel continua sendo a fonte da verdade do pedido.
 */
@Injectable()
export class AdminMailer {
  private readonly logger = new Logger('AdminMailer');
  private readonly sent = new Map<string, number>();

  constructor(
    private readonly gateway: EmailGateway,
    private readonly users: UserDirectory,
    private readonly store: StoreSettingsService,
  ) {}

  get provider() {
    return this.gateway.name;
  }

  /** Quem está recebendo os avisos hoje — mostrado no painel. */
  recipients() {
    return this.users.adminEmails();
  }

  /**
   * Barra a segunda chamada com a mesma chave — um webhook reentregue ou um
   * duplo-clique do admin não gera dois e-mails sobre o mesmo fato.
   */
  private firstTime(key: string) {
    const now = Date.now();
    for (const [k, at] of this.sent) if (now - at > DEDUPE_TTL_MS) this.sent.delete(k);
    if (this.sent.has(key)) return false;
    this.sent.set(key, now);
    return true;
  }

  /** Retorna os destinatários que receberam, ou lista vazia quando nada foi enviado. */
  async notify(template: AdminEmailNotification, doc: AdminEmailDoc, idempotencyKey: string): Promise<string[]> {
    if (!(await this.store.isAdminEmailEnabled(template))) return [];
    if (!this.firstTime(`${template}:${idempotencyKey}`)) return [];

    const to = await this.users.adminEmails();
    if (!to.length) {
      this.logger.warn(`Nenhum administrador com e-mail — aviso "${template}" não enviado.`);
      return [];
    }

    const { name } = await this.store.get();
    const content = renderAdminEmail(doc, name);

    // Uma requisição por destinatário: um endereço que o provedor recusa (uma
    // conta de teste do Resend só entrega para o dono) não pode derrubar o
    // aviso dos outros administradores. De quebra, ninguém vê o e-mail de
    // ninguém no cabeçalho.
    const delivered: string[] = [];
    for (const address of to) {
      try {
        await this.gateway.send({ to: [address], ...content });
        delivered.push(address);
      } catch (err) {
        // Sem reenvio: o aviso é conveniência, o pedido já está no painel.
        this.logger.error(`Falha ao enviar aviso "${template}" para ${address}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!delivered.length) this.sent.delete(`${template}:${idempotencyKey}`);
    else this.logger.log(`Aviso "${template}" enviado para ${delivered.join(', ')}: ${doc.subject}`);
    return delivered;
  }
}
