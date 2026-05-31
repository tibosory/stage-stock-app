import {
  countApEventDocumentsByEventIds,
  findApRoomInspection,
  getApEvent,
  listApConventionsByEvent,
  listApEventPersonnel,
  resolveSpacesForEvent,
  saveApEventReadinessManual,
} from '../db/accueilProDb';
import type { ApEvent, ApEventReadinessManual, ApEventReadinessManualItem } from '../types/accueilPro';
import { parseReadinessManual } from './accueilProEventFilters';

export type ReadinessCheckId =
  | 'convention_signed'
  | 'org_docs'
  | 'edl_entry'
  | 'edl_exit'
  | 'team'
  | 'briefing_done'
  | 'access_ok';

export type ReadinessCheckState = 'ok' | 'partial' | 'missing';

export type ReadinessCheck = {
  id: ReadinessCheckId;
  state: ReadinessCheckState;
  auto: boolean;
  detail?: string;
};

export type EventReadinessSnapshot = {
  event: ApEvent;
  checks: ReadinessCheck[];
  score: number;
  level: 'green' | 'orange' | 'red';
  manual: ApEventReadinessManual;
};

function manualChecked(manual: ApEventReadinessManual, key: keyof ApEventReadinessManual): boolean {
  return !!manual[key]?.checked;
}

function checkState(ok: boolean, partial?: boolean): ReadinessCheckState {
  if (ok) return 'ok';
  if (partial) return 'partial';
  return 'missing';
}

export async function buildEventReadinessSnapshot(eventId: string): Promise<EventReadinessSnapshot | null> {
  const event = await getApEvent(eventId);
  if (!event) return null;

  const manual = parseReadinessManual(event.readiness_manual);
  const [spaces, conventions, team, docCounts] = await Promise.all([
    resolveSpacesForEvent(event),
    listApConventionsByEvent(eventId),
    listApEventPersonnel(eventId),
    countApEventDocumentsByEventIds([eventId]),
  ]);

  const conventionSigned = conventions.some(c => c.status === 'signé' || !!c.signed_at);
  const docCount = docCounts[eventId] ?? 0;

  let edlEntryDone = 0;
  let edlExitDone = 0;
  for (const sp of spaces) {
    const entry = await findApRoomInspection(eventId, sp.id, 'entrée');
    const exit = await findApRoomInspection(eventId, sp.id, 'sortie');
    if (entry?.status === 'terminé') edlEntryDone += 1;
    if (exit?.status === 'terminé') edlExitDone += 1;
  }
  const nSpaces = spaces.length;
  const edlEntryOk = nSpaces === 0 ? true : edlEntryDone === nSpaces;
  const edlEntryPartial = !edlEntryOk && edlEntryDone > 0;
  const edlExitOk = nSpaces === 0 ? true : edlExitDone === nSpaces;
  const edlExitPartial = !edlExitOk && edlExitDone > 0;

  const checks: ReadinessCheck[] = [
    {
      id: 'convention_signed',
      state: checkState(conventionSigned),
      auto: true,
      detail: conventions.length ? `${conventions.filter(c => c.status === 'signé' || c.signed_at).length}/${conventions.length}` : undefined,
    },
    {
      id: 'org_docs',
      state: checkState(docCount > 0),
      auto: true,
      detail: String(docCount),
    },
    {
      id: 'edl_entry',
      state: checkState(edlEntryOk, edlEntryPartial),
      auto: true,
      detail: nSpaces ? `${edlEntryDone}/${nSpaces}` : undefined,
    },
    {
      id: 'edl_exit',
      state: checkState(edlExitOk, edlExitPartial),
      auto: true,
      detail: nSpaces ? `${edlExitDone}/${nSpaces}` : undefined,
    },
    {
      id: 'team',
      state: checkState(team.length > 0),
      auto: true,
      detail: String(team.length),
    },
    {
      id: 'briefing_done',
      state: checkState(manualChecked(manual, 'briefing_done')),
      auto: false,
    },
    {
      id: 'access_ok',
      state: checkState(manualChecked(manual, 'access_ok')),
      auto: false,
    },
  ];

  const okCount = checks.filter(c => c.state === 'ok').length;
  const score = checks.length ? Math.round((okCount / checks.length) * 100) : 0;

  const criticalMissing = checks.some(
    c => (c.id === 'convention_signed' || c.id === 'edl_entry') && c.state === 'missing'
  );
  const level: EventReadinessSnapshot['level'] =
    score === 100 ? 'green'
    : criticalMissing ? 'red'
    : 'orange';

  return { event, checks, score, level, manual };
}

export async function buildEventReadinessSnapshots(eventIds: string[]): Promise<EventReadinessSnapshot[]> {
  const out: EventReadinessSnapshot[] = [];
  for (const id of eventIds) {
    const snap = await buildEventReadinessSnapshot(id);
    if (snap) out.push(snap);
  }
  return out.sort((a, b) =>
    (a.event.heure_debut ?? '').localeCompare(b.event.heure_debut ?? '')
  );
}

export async function toggleEventReadinessManual(
  eventId: string,
  key: keyof ApEventReadinessManual,
  checked: boolean,
  actorName?: string | null
): Promise<ApEventReadinessManual> {
  const event = await getApEvent(eventId);
  const manual = parseReadinessManual(event?.readiness_manual);
  const item: ApEventReadinessManualItem = {
    checked,
    at: checked ? new Date().toISOString() : null,
    by: checked ? actorName ?? null : null,
  };
  const next = { ...manual, [key]: item };
  await saveApEventReadinessManual(eventId, next);
  return next;
}

export function readinessLevelColor(level: EventReadinessSnapshot['level']): string {
  if (level === 'green') return '#2E7D5A';
  if (level === 'red') return '#B54A45';
  return '#C8973A';
}
