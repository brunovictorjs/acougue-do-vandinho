import type { IntegrationEvent } from '../application/integration-events.js';

/** Collects events raised by domain behaviour; repositories publish them after persisting. */
export abstract class AggregateRoot {
  private pendingEvents: IntegrationEvent[] = [];

  protected raise(event: IntegrationEvent) {
    this.pendingEvents.push(event);
  }

  pullEvents(): IntegrationEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }
}
