import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IntegrationEvent } from '../../application/integration-events.js';

/**
 * In-process event bus. Handlers run asynchronously after the publishing use
 * case has committed. When the app moves to Supabase this is the seam for an
 * outbox table if stronger delivery guarantees are needed.
 */
@Injectable()
export class DomainEventPublisher {
  private readonly logger = new Logger('Events');

  constructor(private readonly emitter: EventEmitter2) {}

  publish(...events: IntegrationEvent[]) {
    for (const event of events) {
      this.logger.debug(`→ ${event.name}`);
      // emitAsync so a failing handler never breaks the caller; errors are logged.
      this.emitter.emitAsync(event.name, event).catch((err: unknown) => {
        this.logger.error(`Handler for ${event.name} failed`, err instanceof Error ? err.stack : String(err));
      });
    }
  }
}
