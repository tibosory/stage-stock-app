import assert from 'node:assert/strict';
import { listEventTeamSmsRecipients } from '../lib/eventTeamSmsRecipients';
import type { ApEventPersonnel } from '../types/accueilPro';

function member(partial: Partial<ApEventPersonnel> & Pick<ApEventPersonnel, 'id' | 'name'>): ApEventPersonnel {
  return {
    event_id: 'ev1',
    source: 'directory',
    phone: null,
    email: null,
    ...partial,
  };
}

const team: ApEventPersonnel[] = [
  member({ id: '1', name: 'Alice', phone: '06 12 34 56 78' }),
  member({ id: '2', name: 'Bob', phone: '+33612345678' }),
  member({ id: '3', name: 'Carol', phone: null }),
  member({ id: '4', name: 'Dave', phone: '0611223344' }),
];

const { withPhone, withoutPhone } = listEventTeamSmsRecipients(team);

assert.equal(withPhone.length, 2, 'Alice/Bob même numéro → 1 destinataire + Dave');
assert.equal(withoutPhone.length, 1);
assert.equal(withoutPhone[0]?.name, 'Carol');

console.log('event-team-sms.spec.ts OK');
