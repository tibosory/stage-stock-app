import { countApEventDocumentsByEventIds, listApEvents, listApOrganizations } from '../db/accueilProDb';
import type { ApEvent, ApOrganization } from '../types/accueilPro';

export type PortalOrganizationBlock = {
  organization: ApOrganization;
  events: ApEvent[];
  docCounts: Record<string, number>;
};

export async function listPortalOrganizationBlocks(opts?: {
  organizationId?: string | null;
}): Promise<PortalOrganizationBlock[]> {
  const [orgs, events] = await Promise.all([listApOrganizations(), listApEvents()]);
  const byOrg = new Map<string, ApEvent[]>();

  for (const ev of events) {
    if (!ev.organization_id) continue;
    if (opts?.organizationId && ev.organization_id !== opts.organizationId) continue;
    const list = byOrg.get(ev.organization_id) ?? [];
    list.push(ev);
    byOrg.set(ev.organization_id, list);
  }

  const filteredOrgs =
    opts?.organizationId ? orgs.filter(o => o.id === opts.organizationId) : orgs.filter(o => (byOrg.get(o.id)?.length ?? 0) > 0);

  const blocks: PortalOrganizationBlock[] = filteredOrgs
    .map(organization => {
      const orgEvents = (byOrg.get(organization.id) ?? []).sort((a, b) =>
        (b.date_debut ?? '').localeCompare(a.date_debut ?? '')
      );
      return { organization, events: orgEvents, docCounts: {} as Record<string, number> };
    })
    .filter(b => b.events.length > 0)
    .sort((a, b) => a.organization.name.localeCompare(b.organization.name, 'fr'));

  const eventIds = blocks.flatMap(b => b.events.map(e => e.id));
  const counts = await countApEventDocumentsByEventIds(eventIds);
  for (const block of blocks) {
    block.docCounts = Object.fromEntries(block.events.map(e => [e.id, counts[e.id] ?? 0]));
  }

  return blocks;
}

export function formatPortalEventMeta(ev: ApEvent, docCount: number): string {
  const date = ev.date_debut ?? '—';
  const hours = ev.heure_debut ? ` · ${ev.heure_debut}` : '';
  const docs = docCount > 0 ? ` · ${docCount} doc.` : '';
  return `${date}${hours}${docs}`;
}
