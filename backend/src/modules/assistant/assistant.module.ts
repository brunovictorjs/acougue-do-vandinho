import { Controller, Get, Module } from '@nestjs/common';
import { Roles } from '../../shared/presentation/auth.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { OrderingModule } from '../ordering/ordering.module.js';
import { StoreModule } from '../store/store.module.js';
import { SupportModule } from '../support/support.module.js';
import { AssistantTools } from './application/assistant-tools.js';
import { AssistantService } from './application/assistant.service.js';
import { DEFAULT_ASSISTANT_PROMPT, GUARDRAILS } from './domain/prompt.js';
import { ClaudeEngine } from './infrastructure/claude.engine.js';
import { RuleBasedEngine } from './infrastructure/rule-based.engine.js';

@Roles('ADMIN')
@Controller('admin/assistant')
export class AssistantAdminController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly tools: AssistantTools,
  ) {}

  @Get()
  info() {
    return {
      engine: this.assistant.engine,
      defaultPrompt: DEFAULT_ASSISTANT_PROMPT,
      guardrails: GUARDRAILS,
      tools: this.tools.definitions.map((t) => ({ name: t.name, description: t.description })),
    };
  }
}

@Module({
  imports: [CatalogModule, OrderingModule, StoreModule, SupportModule, IdentityModule, MessagingModule],
  controllers: [AssistantAdminController],
  providers: [AssistantService, AssistantTools, ClaudeEngine, RuleBasedEngine],
})
export class AssistantModule {}
