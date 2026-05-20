import assert from 'node:assert/strict';
import { DomainEventBus } from '../application/events';

async function testPublishAndSubscribe() {
  DomainEventBus.clearAllSubscribers();
  const received: Array<{ assignmentId?: string; nextStatus?: string }> = [];
  const unsubscribe = DomainEventBus.subscribe('assignment.status_changed', event => {
    received.push({
      assignmentId: typeof event.payload.assignmentId === 'string' ? event.payload.assignmentId : undefined,
      nextStatus: typeof event.payload.nextStatus === 'string' ? event.payload.nextStatus : undefined,
    });
  });

  await DomainEventBus.publish('assignment.status_changed', {
    assignmentId: 'a-1',
    nextStatus: 'in_use',
  });
  unsubscribe();
  await DomainEventBus.publish('assignment.status_changed', {
    assignmentId: 'a-2',
    nextStatus: 'returned',
  });

  assert.equal(received.length, 1, 'unsubscribed handler must not receive next events');
  assert.equal(received[0]?.assignmentId, 'a-1');
  assert.equal(received[0]?.nextStatus, 'in_use');
}

async function run() {
  await testPublishAndSubscribe();
  console.log('domain-event-bus.spec: OK');
}

void run();
