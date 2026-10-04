import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { EmailGateway, EmailMessage, EmailSendError, EmailSendResult } from '../domain/email-gateway.js';

/**
 * Adaptador do Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Para ligar: EMAIL_PROVIDER=resend, RESEND_API_KEY e um EMAIL_FROM em domínio
 * verificado na conta — o Resend recusa remetente de domínio não verificado.
 */
@Injectable()
export class ResendEmailGateway extends EmailGateway {
  readonly name = 'resend' as const;
  private readonly logger = new Logger('Resend');

  constructor(private readonly config: AppConfig) {
    super();
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const { resendBaseUrl, resendApiKey, from } = this.config.email;

    let res: Response;
    try {
      res = await fetch(`${resendBaseUrl}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendApiKey}` },
        body: JSON.stringify({ from, to: message.to, subject: message.subject, text: message.text, html: message.html }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      // Falha de rede ou timeout: o e-mail pode ter saído ou não, e quem chama
      // tem de assumir que não saiu.
      throw new EmailSendError(`Resend inacessível: ${err instanceof Error ? err.message : String(err)}`, true);
    }

    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`Resend falhou (${res.status}): ${text}`);
      // 429 é limite de taxa e 5xx é o lado do provedor — ambos passam depois.
      // Qualquer outro 4xx é requisição errada, repetir só gera o mesmo erro.
      throw new EmailSendError(`Resend ${res.status}: ${text.slice(0, 300)}`, res.status === 429 || res.status >= 500, res.status);
    }

    const json = JSON.parse(text || '{}') as { id?: string };
    return { providerMessageId: json.id ?? null };
  }
}
