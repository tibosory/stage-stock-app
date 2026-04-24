import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Pret, PretMateriel } from '../types';
import { getPdfBranding, buildPdfOrgHeaderHtml } from './theatreBranding';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** SQLite / sync peuvent renvoyer nombre, chaîne « 12,5 » ou « 12.5 ». */
function parseNumeric(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null;
  }
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '' || s === '-' || s === '.') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function qte(l: PretMateriel): number {
  const n = parseNumeric(l.quantite as unknown);
  return n != null && n > 0 ? n : 1;
}

/** Montant ligne si prix unitaire renseigné sur la fiche matériel */
function ligneMontantEur(l: PretMateriel): number | null {
  const pu = parseNumeric(l.materiel_prix_unitaire as unknown);
  if (pu == null) return null;
  const line = qte(l) * pu;
  return Number.isFinite(line) ? line : null;
}

/** Poids total pour la ligne (poids unitaire matériel × quantité) */
function lignePoidsKg(l: PretMateriel): number | null {
  const pk = parseNumeric(l.materiel_poids_kg as unknown);
  if (pk == null) return null;
  const line = qte(l) * pk;
  return Number.isFinite(line) ? line : null;
}

/** Format nombre FR pour moteur PDF (pas de locale instable) */
function fmtEuro(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const s = n.toFixed(2).replace('.', ',');
  return `${s} €`;
}

function fmtKg(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const t = n % 1 === 0 ? n.toFixed(0) : n.toFixed(2).replace('.', ',');
  return `${t} kg`;
}

export async function exportFichePretPdf(
  pret: Pret,
  lignes: PretMateriel[]
): Promise<void> {
  const branding = await getPdfBranding();
  const orgHeader = buildPdfOrgHeaderHtml(branding);

  let sumMontant = 0;
  let sumPoids = 0;
  let anyMontant = false;
  let anyPoids = false;

  const rows = lignes
    .map(l => {
      const m = ligneMontantEur(l);
      const p = lignePoidsKg(l);
      if (m != null && Number.isFinite(m)) {
        sumMontant += m;
        anyMontant = true;
      }
      if (p != null && Number.isFinite(p)) {
        sumPoids += p;
        anyPoids = true;
      }

      const montCell = m != null ? esc(fmtEuro(m)) : '—';
      const poidsCell = p != null ? esc(fmtKg(p)) : '—';

      return (
        `<tr>` +
        `<td>${esc(l.materiel_nom ?? l.materiel_id)}</td>` +
        `<td style="text-align:right">${esc(String(qte(l)))}</td>` +
        `<td style="text-align:right">${montCell}</td>` +
        `<td style="text-align:right">${poidsCell}</td>` +
        `<td>${l.retourne ? 'Rendu' : 'Sorti'}</td>` +
        `<td>${esc(l.etat_au_retour ?? '—')}</td>` +
        `</tr>`
      );
    })
    .join('');

  const totalMontantCell =
    anyMontant && Number.isFinite(sumMontant) ? `<strong>${esc(fmtEuro(sumMontant))}</strong>` : '—';
  const totalPoidsCell =
    anyPoids && Number.isFinite(sumPoids) ? `<strong>${esc(fmtKg(sumPoids))}</strong>` : '—';

  const totalsRow =
    lignes.length > 0
      ? `<tr class="totalrow">` +
        `<td colspan="2"><strong>Totaux (matériel prêté)</strong></td>` +
        `<td class="total-amount" style="text-align:right">${totalMontantCell}</td>` +
        `<td style="text-align:right">${totalPoidsCell}</td>` +
        `<td colspan="2"></td>` +
        `</tr>`
      : '';

  const sigBlock = pret.signature_emprunteur_data
    ? `<div class="sig"><p class="sig-title"><strong>Signature emprunteur</strong> (${esc(pret.signed_at ?? '')})</p><div class="sig-img-wrap"><span class="sig-img-bg" aria-hidden="true"></span><img class="sig-img" src="data:image/png;base64,${pret.signature_emprunteur_data}" alt="Signature" /></div></div>`
    : '<p><em>Signature non enregistrée dans l’app</em></p>';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  <style>
    @page { size: A4; margin: 12mm; }
    html {
      color-scheme: only light;
      background: #ffffff !important;
    }
    body {
      font-family: "Inter", "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      font-size: 11.5px;
      line-height: 1.35;
      margin: 0;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .title {
      font-size: 21px;
      font-weight: 700;
      letter-spacing: 0.2px;
      margin: 0 0 10px 0;
      color: #111827;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px 10px;
      margin-bottom: 14px;
    }
    .meta-item {
      border: 1px solid #6b7280;
      border-radius: 7px;
      padding: 7px 8px;
      background: #ffffff;
    }
    .meta-item.gray-zone { background: #e5e7eb; }
    .meta-label { color: #374151; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
    .meta-value { margin-top: 2px; color: #111827; font-weight: 600; word-break: break-word; }
    .wide { grid-column: 1 / span 2; }
    h2 {
      font-size: 14px;
      margin: 12px 0 8px 0;
      color: #111827;
      letter-spacing: 0.2px;
    }
    table.mats {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #6b7280;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 6px;
      font-size: 9.5px;
    }
    .mats th, .mats td { padding: 6px 7px; text-align: left; border-bottom: 1px solid #9ca3af; vertical-align: top; }
    .mats th {
      background: #ffffff;
      color: #111827;
      font-size: 9px;
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }
    .mats tbody tr:nth-child(even) td { background: #ffffff; }
    .mats tr.totalrow td { background: #ffffff; font-size: 10px; border-bottom: none; }
    .mats tr.totalrow td.total-amount { background: #d1d5db; }
    .hint { font-size: 9.5px; color: #374151; margin: 6px 0 0 0; font-style: italic; }
    .sig {
      margin-top: 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sig-title { margin: 0 0 8px 0; color: #111827 !important; }
    .sig-img-wrap {
      position: relative;
      display: inline-block;
      max-width: 260px;
      padding: 8px;
      background: #ffffff !important;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      vertical-align: top;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sig-img-bg {
      position: absolute;
      inset: 8px;
      background: #ffffff !important;
      border-radius: 4px;
      z-index: 0;
    }
    .sig-img {
      position: relative;
      z-index: 1;
      display: block;
      max-width: 240px;
      height: auto;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  ${orgHeader}
  <h1 class="title">Fiche de prêt</h1>

  <div class="meta-grid">
    <div class="meta-item"><div class="meta-label">N° feuille</div><div class="meta-value">${esc(pret.numero_feuille ?? '—')}</div></div>
    <div class="meta-item"><div class="meta-label">Statut</div><div class="meta-value">${esc(pret.statut)}</div></div>
    <div class="meta-item gray-zone"><div class="meta-label">Emprunteur</div><div class="meta-value">${esc(pret.emprunteur)}</div></div>
    <div class="meta-item gray-zone"><div class="meta-label">Organisation</div><div class="meta-value">${esc(pret.organisation ?? '—')}</div></div>
    <div class="meta-item gray-zone"><div class="meta-label">Téléphone</div><div class="meta-value">${esc(pret.telephone ?? '—')}</div></div>
    <div class="meta-item gray-zone"><div class="meta-label">E-mail</div><div class="meta-value">${esc(pret.email ?? '—')}</div></div>
    <div class="meta-item"><div class="meta-label">Date de départ</div><div class="meta-value">${esc(pret.date_depart)}</div></div>
    <div class="meta-item"><div class="meta-label">Retour prévu</div><div class="meta-value">${esc(pret.retour_prevu ?? '—')}</div></div>
    <div class="meta-item"><div class="meta-label">Retour réel</div><div class="meta-value">${esc(pret.retour_reel ?? '—')}</div></div>
    <div class="meta-item gray-zone"><div class="meta-label">Valeur estimée (feuille)</div><div class="meta-value">${(() => {
      const v = parseNumeric(pret.valeur_estimee as unknown);
      return v != null ? esc(fmtEuro(v)) : pret.valeur_estimee != null && String(pret.valeur_estimee).trim() !== ''
        ? esc(String(pret.valeur_estimee).trim()) + ' €'
        : '—';
    })()}</div></div>
    <div class="meta-item wide"><div class="meta-label">Commentaire</div><div class="meta-value">${esc(pret.commentaire ?? '—')}</div></div>
  </div>

  <h2>Matériels</h2>
  <p class="hint">Montants : prix unitaire × quantité (fiches matériel). Poids : poids unitaire × quantité (kg).</p>
  <table class="mats">
    <thead><tr>
      <th>Article</th>
      <th style="text-align:right">Qté</th>
      <th style="text-align:right">Montant (€)</th>
      <th style="text-align:right">Poids (kg)</th>
      <th>Statut ligne</th>
      <th>État au retour</th>
    </tr></thead>
    <tbody>
      ${rows || '<tr><td colspan="6">Aucune ligne</td></tr>'}
      ${totalsRow}
    </tbody>
  </table>

  ${sigBlock}
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Fiche de prêt' });
}
