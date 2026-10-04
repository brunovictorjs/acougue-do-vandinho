import { Injectable, Logger } from '@nestjs/common';
import { EmailGateway, EmailMessage, EmailSendResult } from '../domain/email-gateway.js';

/** Modo de teste: todo e-mail que iria para a administração é impresso aqui. */
@Injectable()
export class LogEmailGateway extends EmailGateway {
  readonly name = 'log' as const;
  private readonly logger = new Logger('Email');

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const line = '─'.repeat(60);
    const body = message.text.split('\n').map((l) => `│ ${l}`).join('\n');
    this.logger.log(`\n┌${line}\n│ Para: ${message.to.join(', ')}\n│ Assunto: ${message.subject}\n├${line}\n${body}\n└${line}`);
    return { providerMessageId: null };
  }
}
