import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppConfig } from '../../../config/app-config.js';
import { Events, type WhatsAppMessageReceivedEvent } from '../../../shared/application/integration-events.js';
import { UserDirectory } from '../../identity/application/user-directory.js';
import { WhatsAppSender } from '../../messaging/application/whatsapp-sender.service.js';
import { StoreSettingsService } from '../../store/application/store-settings.service.js';
import { DEFAULT_ASSISTANT_PROMPT, GUARDRAILS } from '../domain/prompt.js';
import { ClaudeEngine, Turn } from '../infrastructure/claude.engine.js';
import { RuleBasedEngine } from '../infrastructure/rule-based.engine.js';
import { ToolContext } from './assistant-tools.js';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger('Assistant');

  constructor(
    private readonly config: AppConfig,
    private readonly settings: StoreSettingsService,
    private readonly users: UserDirectory,
    private readonly sender: WhatsAppSender,
    private readonly claude: ClaudeEngine,
    private readonly rules: RuleBasedEngine,
  ) {}

  get engine() {
    return this.config.assistant.apiKey ? `claude (${this.config.assistant.model})` : 'regras (sem ANTHROPIC_API_KEY)';
  }

  @OnEvent(Events.WhatsAppMessageReceived)
  async onMessage(e: WhatsAppMessageReceivedEvent) {
    const settings = await this.settings.get();
    if (!settings.assistantEnabled) return;

    const customer = await this.users.findByVerifiedPhone(e.phone);
    const ctx: ToolContext = { phone: e.phone, customer, handoff: false };
    let reply: string;
    try {
      reply = this.config.assistant.apiKey ? await this.claudeReply(e.phone, settings.assistantPrompt, ctx) : await this.rules.reply(e.text, ctx);
    } catch {
      reply = 'Tive um problema para responder agora. Tente de novo em instantes ou peça para falar com um atendente.';
    }
    await this.sender.text(e.phone, reply, { assistant: true, handoff: ctx.handoff });
  }

  private async claudeReply(phone: string, adminPrompt: string, ctx: ToolContext) {
    const history = await this.sender.history(phone, this.config.assistant.historyLimit);
    const turns: Turn[] = [];
    for (const m of history) {
      const role = m.direction === 'INBOUND' ? 'user' : 'assistant';
      const text = m.kind === 'location' ? `[localização enviada] ${m.body}` : m.body;
      const last = turns[turns.length - 1];
      if (last?.role === role) last.text += `\n\n${text}`;
      else turns.push({ role, text });
    }
    while (turns[0]?.role === 'assistant') turns.shift();
    if (!turns.length) return 'Oi! Como posso ajudar?';

    const who = ctx.customer
      ? `Cliente desta conversa: ${ctx.customer.fullName} (cadastrado, número verificado).`
      : 'Este número NÃO está vinculado a uma conta: não há pedidos para consultar. Convide a pessoa a se cadastrar no site para comprar.';
    const system = [
      { text: `${(adminPrompt || DEFAULT_ASSISTANT_PROMPT).trim()}\n\n${GUARDRAILS}`, cache: true },
      { text: `${who}\nData e hora atuais: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.` },
    ];
    return this.claude.reply(system, turns, ctx);
  }
}
