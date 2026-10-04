import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { AssistantTools, ToolContext } from '../application/assistant-tools.js';

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

const MAX_TOOL_ROUNDS = 6;

/**
 * Claude with a manual tool loop. Thinking is adaptive (always on for this
 * model) and effort defaults to "low" — chat routes rarely need more. The
 * server-side fallback lets a declined request be retried on a fallback model
 * automatically.
 */
@Injectable()
export class ClaudeEngine {
  private readonly logger = new Logger('ClaudeEngine');
  private readonly client: Anthropic;

  constructor(
    private readonly config: AppConfig,
    private readonly tools: AssistantTools,
  ) {
    this.client = new Anthropic({ apiKey: config.assistant.apiKey });
  }

  async reply(system: Array<{ text: string; cache?: boolean }>, turns: Turn[], ctx: ToolContext): Promise<string> {
    const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => ({ role: t.role, content: t.text }));
    const tools: Anthropic.Beta.BetaTool[] = this.tools.definitions.map((d) => ({ ...d, strict: true }));
    const systemBlocks: Anthropic.Beta.BetaTextBlockParam[] = system.map((s) => ({
      type: 'text',
      text: s.text,
      ...(s.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    }));

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await this.client.beta.messages.create({
          model: this.config.assistant.model,
          // Covers thinking + reply: on this model thinking is on by default
          // and shares the budget, so a tight cap truncates the answer.
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: this.config.assistant.effort },
          system: systemBlocks,
          tools,
          messages,
        });
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) this.logger.warn('Limite de requisições da API atingido.');
        else if (err instanceof Anthropic.AuthenticationError) this.logger.error('ANTHROPIC_API_KEY inválida.');
        else if (err instanceof Anthropic.APIError) this.logger.error(`Erro da API (${err.status}): ${err.message}`);
        else this.logger.error('Falha ao chamar a API', err instanceof Error ? err.stack : String(err));
        throw err;
      }

      if (response.stop_reason === 'refusal') {
        return 'Desculpe, não consigo ajudar com isso. Posso te ajudar com produtos, ofertas ou seus pedidos?';
      }

      messages.push({ role: 'assistant', content: response.content });
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');

      if (response.stop_reason !== 'tool_use' || !toolUses.length) {
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return text || 'Pode repetir, por favor? Não entendi bem.';
      }

      // Run every requested tool and answer them all in a single user turn.
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (t) => {
          try {
            const content = await this.tools.run(t.name, (t.input ?? {}) as Record<string, unknown>, ctx);
            return { type: 'tool_result' as const, tool_use_id: t.id, content };
          } catch (err) {
            this.logger.error(`Ferramenta ${t.name} falhou`, err instanceof Error ? err.stack : String(err));
            return { type: 'tool_result' as const, tool_use_id: t.id, content: 'Erro ao consultar os dados.', is_error: true };
          }
        }),
      );
      messages.push({ role: 'user', content: results });
    }
    return 'Estou com dificuldade para consultar isso agora. Quer falar com um dos nossos atendentes?';
  }
}
