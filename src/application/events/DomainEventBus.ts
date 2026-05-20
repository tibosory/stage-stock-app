export type DomainEventName =
  | 'tour.created'
  | 'tour.updated'
  | 'tour.location_added'
  | 'assignment.created'
  | 'assignment.moved'
  | 'assignment.status_changed'
  | 'profile.created'
  | 'profile.schema_version_saved';

export type DomainEvent = {
  name: DomainEventName;
  at: string;
  payload: Record<string, unknown>;
};

type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;

const handlersByName: Partial<Record<DomainEventName, Set<DomainEventHandler>>> = {};

function getHandlers(name: DomainEventName): Set<DomainEventHandler> {
  if (!handlersByName[name]) {
    handlersByName[name] = new Set<DomainEventHandler>();
  }
  return handlersByName[name] as Set<DomainEventHandler>;
}

export const DomainEventBus = {
  subscribe(name: DomainEventName, handler: DomainEventHandler): () => void {
    const handlers = getHandlers(name);
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  },

  async publish(name: DomainEventName, payload: Record<string, unknown>): Promise<void> {
    const event: DomainEvent = {
      name,
      at: new Date().toISOString(),
      payload,
    };
    const handlers = Array.from(getHandlers(name));
    for (const handler of handlers) {
      await handler(event);
    }
  },

  clearAllSubscribers(): void {
    (Object.keys(handlersByName) as DomainEventName[]).forEach(name => {
      handlersByName[name]?.clear();
    });
  },
};
