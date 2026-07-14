import React from 'react';
import { Text, View } from 'react-native';
import { AccueilProContactCard } from './AccueilProContactCard';
import { AccueilProFormCard, apStyles } from './AccueilProUI';
import { Spacing } from '../../theme/spacing';
import type { ApCapiDossierRef } from '../../types/accueilPro';

function fmtDate(d?: string | null): string | null {
  if (!d?.trim()) return null;
  const t = d.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const [y, m, day] = t.slice(0, 10).split('-');
    return `${day}/${m}/${y}`;
  }
  return t;
}

function JalonLine({ label, value }: { label: string; value?: string | null }) {
  const v = fmtDate(value);
  if (!v) return null;
  return (
    <Text style={apStyles.detailLine}>
      <Text style={apStyles.detailLabel}>{label} : </Text>
      {v}
    </Text>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <>
      <View style={apStyles.sectionHeader}>
        <Text style={apStyles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </>
  );
}

export function AccueilProCapiDossierPanel({ dossier }: { dossier: ApCapiDossierRef | null }) {
  if (!dossier) {
    return (
      <AccueilProFormCard>
        <Text style={apStyles.empty}>
          Aucun dossier accueil CAPI synchronisé pour cet événement. Lancez une synchronisation depuis l’accueil
          Accueil Pro.
        </Text>
      </AccueilProFormCard>
    );
  }

  const hasReferents =
    dossier.contactCompagnieNom ||
    dossier.contactCompagnieTel ||
    dossier.contactCompagnieEmail ||
    dossier.referentsCompagnie.length > 0;

  return (
    <>
      <AccueilProFormCard>
        <Text style={apStyles.detailLine}>
          <Text style={apStyles.detailLabel}>Compagnie : </Text>
          {dossier.compagnie || '—'}
        </Text>
      </AccueilProFormCard>

      <Section title="Jalons (CAPI)">
        <AccueilProFormCard style={{ marginBottom: Spacing.sm }}>
          <JalonLine label="Représentations" value={dossier.dateRepresentationDebut} />
          {dossier.dateRepresentationFin && dossier.dateRepresentationFin !== dossier.dateRepresentationDebut ? (
            <JalonLine label="Fin représentations" value={dossier.dateRepresentationFin} />
          ) : null}
          {dossier.representations.map((r, i) => {
            const d = fmtDate(r.dateHeure);
            if (!d) return null;
            return (
              <Text key={`${r.dateHeure}-${i}`} style={apStyles.detailLine}>
                <Text style={apStyles.detailLabel}>{r.libelle?.trim() || 'Séance'} : </Text>
                {d}
              </Text>
            );
          })}
          <JalonLine label="Occupation début" value={dossier.dateOccupationDebut} />
          <JalonLine label="Occupation fin" value={dossier.dateOccupationFin} />
          {dossier.premontageRequis ? (
            <>
              <JalonLine label="Prémontage début" value={dossier.datePremontageDebut} />
              <JalonLine label="Prémontage fin" value={dossier.datePremontageFin} />
            </>
          ) : null}
          <JalonLine label="Démontage" value={dossier.dateDemontage} />
        </AccueilProFormCard>
      </Section>

      {hasReferents ? (
        <Section title="Référents association">
          {dossier.contactCompagnieNom ? (
            <AccueilProContactCard
              displayName={dossier.contactCompagnieNom}
              lines={[
                dossier.compagnie ? { label: 'Compagnie', value: dossier.compagnie } : null,
                dossier.contactCompagnieTel ? { label: 'Tél.', value: dossier.contactCompagnieTel } : null,
                dossier.contactCompagnieEmail ? { label: 'E-mail', value: dossier.contactCompagnieEmail } : null,
              ].filter((x): x is { label: string; value: string } => Boolean(x))}
              phone={dossier.contactCompagnieTel}
              email={dossier.contactCompagnieEmail}
              emailSubject={`Accueil · ${dossier.compagnie}`}
            />
          ) : null}
          {dossier.referentsCompagnie.map((r, i) => (
            <AccueilProContactCard
              key={r.id ?? `${r.nom}-${i}`}
              displayName={r.nom}
              lines={[
                r.fonction ? { label: 'Fonction', value: r.fonction } : null,
                r.organisation ? { label: 'Organisation', value: r.organisation } : null,
                r.telephone ? { label: 'Tél.', value: r.telephone } : null,
                r.email ? { label: 'E-mail', value: r.email } : null,
              ].filter((x): x is { label: string; value: string } => Boolean(x))}
              phone={r.telephone}
              email={r.email}
              emailSubject={`Accueil · ${r.nom}`}
            />
          ))}
        </Section>
      ) : null}

      {dossier.contactsLocalCrew.length > 0 ? (
        <Section title="Équipe locale (accueil)">
          {dossier.contactsLocalCrew.map((c, i) => (
            <AccueilProContactCard
              key={`${c.nom}-${i}`}
              displayName={c.nom?.trim() || c.role?.trim() || 'Contact'}
              lines={[
                c.role ? { label: 'Rôle', value: c.role } : null,
                c.tel ? { label: 'Tél.', value: c.tel } : null,
                c.notes ? { label: 'Notes', value: c.notes } : null,
              ].filter((x): x is { label: string; value: string } => Boolean(x))}
              phone={c.tel}
            />
          ))}
        </Section>
      ) : null}

      {dossier.zonesAccueil.some((z) => z.zone?.trim() || z.notes?.trim()) ? (
        <Section title="Zones d'accueil">
          <AccueilProFormCard style={{ marginBottom: Spacing.sm }}>
            {dossier.zonesAccueil.map((z, i) => (
              <View key={`${z.zone}-${i}`} style={{ marginBottom: i < dossier.zonesAccueil.length - 1 ? 8 : 0 }}>
                <Text style={apStyles.rowTitle}>{z.zone || 'Zone'}</Text>
                {z.notes?.trim() ? <Text style={apStyles.rowMeta}>{z.notes}</Text> : null}
              </View>
            ))}
          </AccueilProFormCard>
        </Section>
      ) : null}

      {dossier.transportsAccueil.length > 0 ? (
        <Section title="Transports">
          {dossier.transportsAccueil.map((t, i) => (
            <AccueilProFormCard key={`tr-${i}`} style={{ marginBottom: Spacing.sm }}>
              {t.trajet ? <Text style={apStyles.rowTitle}>{t.trajet}</Text> : null}
              {t.datePrevue ? <Text style={apStyles.detailLine}>Date : {fmtDate(t.datePrevue)}</Text> : null}
              {t.entreprise ? <Text style={apStyles.detailLine}>Entreprise : {t.entreprise}</Text> : null}
              {t.livraisonPar ? <Text style={apStyles.detailLine}>Livraison : {t.livraisonPar}</Text> : null}
              {t.enlèvementPar ? <Text style={apStyles.detailLine}>Enlèvement : {t.enlèvementPar}</Text> : null}
              {t.notes ? <Text style={apStyles.rowMeta}>{t.notes}</Text> : null}
            </AccueilProFormCard>
          ))}
        </Section>
      ) : null}

      {dossier.hebergements.length > 0 ? (
        <Section title="Hébergements">
          {dossier.hebergements.map((h, i) => (
            <AccueilProFormCard key={`hb-${i}`} style={{ marginBottom: Spacing.sm }}>
              <Text style={apStyles.rowTitle}>{h.label}</Text>
              {h.adresse ? <Text style={apStyles.detailLine}>{h.adresse}</Text> : null}
              {h.contact ? <Text style={apStyles.detailLine}>Contact : {h.contact}</Text> : null}
              {h.tel ? <Text style={apStyles.detailLine}>Tél. : {h.tel}</Text> : null}
              {h.notes ? <Text style={apStyles.rowMeta}>{h.notes}</Text> : null}
            </AccueilProFormCard>
          ))}
        </Section>
      ) : null}

      {dossier.repas.length > 0 ? (
        <Section title="Repas">
          {dossier.repas.map((r, i) => (
            <AccueilProFormCard key={`rp-${i}`} style={{ marginBottom: Spacing.sm }}>
              <Text style={apStyles.rowTitle}>{r.creneau || 'Repas'}</Text>
              {r.lieu ? <Text style={apStyles.detailLine}>Lieu : {r.lieu}</Text> : null}
              {r.nbPersonnes ? <Text style={apStyles.detailLine}>Personnes : {r.nbPersonnes}</Text> : null}
              {r.notes ? <Text style={apStyles.rowMeta}>{r.notes}</Text> : null}
            </AccueilProFormCard>
          ))}
        </Section>
      ) : null}

      {dossier.loges.length > 0 ? (
        <Section title="Loges">
          {dossier.loges.map((l, i) => (
            <AccueilProFormCard key={`lg-${i}`} style={{ marginBottom: Spacing.sm }}>
              <Text style={apStyles.rowTitle}>{l.nom}</Text>
              {l.attribution ? <Text style={apStyles.detailLine}>Attribution : {l.attribution}</Text> : null}
              {l.notes ? <Text style={apStyles.rowMeta}>{l.notes}</Text> : null}
            </AccueilProFormCard>
          ))}
        </Section>
      ) : null}

      {dossier.personnelAccueil?.trim() ? (
        <Section title="Personnel accueil">
          <AccueilProFormCard>
            <Text style={apStyles.detailLine}>{dossier.personnelAccueil}</Text>
          </AccueilProFormCard>
        </Section>
      ) : null}

      {dossier.notesAccueil?.trim() ? (
        <Section title="Notes accueil">
          <AccueilProFormCard>
            <Text style={apStyles.detailLine}>{dossier.notesAccueil}</Text>
          </AccueilProFormCard>
        </Section>
      ) : null}

      {dossier.equipe.length > 0 ? (
        <Section title="Équipe compagnie (CAPI)">
          {dossier.equipe.map((m, i) => (
            <AccueilProContactCard
              key={m.id ?? `${m.nom}-${i}`}
              displayName={m.nom}
              badge={m.origin === 'planning' ? 'Planning CAPI' : 'CAPI'}
              lines={[
                m.role ? { label: 'Rôle', value: m.role } : null,
                m.telephone ? { label: 'Tél.', value: m.telephone } : null,
                m.email ? { label: 'E-mail', value: m.email } : null,
              ].filter((x): x is { label: string; value: string } => Boolean(x))}
              phone={m.telephone}
              email={m.email}
              emailSubject={`Accueil · ${m.nom}`}
            />
          ))}
        </Section>
      ) : null}

      {dossier.planningPersonnel?.length ? (
        <Section title="Planning par personne (CAPI)">
          {dossier.planningPersonnel.map((p, i) => (
            <AccueilProFormCard key={`pp-${p.nom}-${i}`} style={{ marginBottom: Spacing.sm }}>
              <Text style={apStyles.rowTitle}>{p.nom}</Text>
              {p.creneaux.map((c, j) => (
                <Text key={`${c.dateKey}-${j}`} style={apStyles.detailLine}>
                  {fmtDate(c.dateKey) ?? c.dateKey}
                  {c.debut || c.fin ? ` · ${c.debut ?? '?'}-${c.fin ?? '?'}` : ''}
                  {` · ${c.titre}`}
                  {c.poste ? ` (${c.poste})` : ''}
                </Text>
              ))}
            </AccueilProFormCard>
          ))}
        </Section>
      ) : null}

      {dossier.updatedAt ? (
        <Text style={[apStyles.hint, { marginTop: Spacing.sm }]}>
          Dossier CAPI synchronisé : {fmtDate(dossier.updatedAt.slice(0, 10)) ?? dossier.updatedAt}
        </Text>
      ) : null}
    </>
  );
}

export function AccueilProCapiTechniquePanel({ dossier }: { dossier: ApCapiDossierRef | null }) {
  if (!dossier) {
    return (
      <AccueilProFormCard>
        <Text style={apStyles.empty}>Aucun résumé technique CAPI synchronisé.</Text>
      </AccueilProFormCard>
    );
  }
  const besoins = dossier.besoinsTechnique ?? [];
  if (!besoins.length) {
    return (
      <AccueilProFormCard>
        <Text style={apStyles.empty}>
          Aucun besoin technique renseigné sur la fiche CAPI pour cet événement.
        </Text>
      </AccueilProFormCard>
    );
  }
  const byPole = besoins.reduce<Record<string, typeof besoins>>((acc, b) => {
    (acc[b.pole] ??= []).push(b);
    return acc;
  }, {});
  return (
    <>
      {Object.entries(byPole).map(([pole, items]) => (
        <Section key={pole} title={pole}>
          <AccueilProFormCard style={{ marginBottom: Spacing.sm }}>
            {items.map((b, i) => (
              <View key={`${b.label}-${i}`} style={{ marginBottom: i < items.length - 1 ? 8 : 0 }}>
                <Text style={apStyles.detailLabel}>{b.label}</Text>
                <Text style={apStyles.detailLine}>{b.value}</Text>
              </View>
            ))}
          </AccueilProFormCard>
        </Section>
      ))}
      {dossier.updatedAt ? (
        <Text style={apStyles.hint}>
          Synchronisé : {fmtDate(dossier.updatedAt.slice(0, 10)) ?? dossier.updatedAt}
        </Text>
      ) : null}
    </>
  );
}
