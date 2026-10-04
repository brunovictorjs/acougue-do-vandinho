export interface EmailMessage {
  /** Um ou mais destinatários — todos recebem a mesma cópia. */
  to: string[];
  subject: string;
  /** Corpo em texto puro; é o que aparece em cliente sem HTML. */
  text: string;
  html: string;
}

export interface EmailSendResult {
  providerMessageId: string | null;
}

/**
 * Um envio recusado. `retryable` separa o que vale repetir (timeout, 429,
 * 5xx do provedor) do que nunca vai passar (endereço inválido, 400).
 */
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'EmailSendError';
  }
}

/**
 * Porta de e-mail transacional. `LogEmailGateway` (padrão) imprime a mensagem
 * no log do servidor; `ResendEmailGateway` entrega de verdade quando
 * EMAIL_PROVIDER=resend.
 *
 * Quem envia aviso não usa a porta direto: `AdminMailer` resolve destinatários
 * e tratamento de falha.
 */
export abstract class EmailGateway {
  abstract readonly name: 'log' | 'resend';
  abstract send(message: EmailMessage): Promise<EmailSendResult>;
}
