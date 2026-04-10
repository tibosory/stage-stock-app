import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Pret, PretMateriel } from '../types';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportFichePretPdf(
  pret: Pret,
  lignes: (PretMateriel & { materiel_nom?: string })[]
): Promise<void> {
  const rows = lignes
    .map(
      l =>
        `<tr><td>${esc(l.materiel_nom ?? l.materiel_id)}</td><td>${l.retourne ? 'Rendu' : 'Sorti'}</td><td>${esc(l.etat_au_retour ?? '—')}</td></tr>`
    )
    .join('');

  const sigBlock = pret.signature_emprunteur_data
    ? `<div class="sig"><p><strong>Signature emprunteur</strong> (${esc(pret.signed_at ?? '')})</p><img src="data:image/png;base64,${pret.signature_emprunteur_data}" style="max-width:220px;border:1px solid #ccc;" /></div>`
    : '<p><em>Signature non enregistrée dans l’app</em></p>';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Helvetica, Arial, sans-serif; padding: 16px; color: #111; font-size: 12px; }
    h1 { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
    th { background: #eee; }
    .block { margin-bottom: 10px; }
    .sig { margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Fiche de prêt — Théâtre</h1>
  <div class="block"><strong>N° feuille :</strong> ${esc(pret.numero_feuille ?? '—')}</div>
  <div class="block"><strong>Statut :</strong> ${esc(pret.statut)}</div>
  <div class="block"><strong>Emprunteur :</strong> ${esc(pret.emprunteur)}</div>
  <div class="block"><strong>Organisation :</strong> ${esc(pret.organisation ?? '—')}</div>
  <div class="block"><strong>Tél. :</strong> ${esc(pret.telephone ?? '—')} &nbsp; <strong>Email :</strong> ${esc(pret.email ?? '—')}</div>
  <div class="block"><strong>Départ :</strong> ${esc(pret.date_depart)} &nbsp; <strong>Retour prévu :</strong> ${esc(pret.retour_prevu ?? '—')}</div>
  <div class="block"><strong>Retour réel :</strong> ${esc(pret.retour_reel ?? '—')}</div>
  <div class="block"><strong>Valeur estimée :</strong> ${pret.valeur_estimee != null ? esc(String(pret.valeur_estimee)) + ' €' : '—'}</div>
  <div class="block"><strong>Commentaire :</strong> ${esc(pret.commentaire ?? '—')}</div>

  <h2>Matériels</h2>
  <table>
    <thead><tr><th>Désignation</th><th>Statut ligne</th><th>État au retour</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3">Aucune ligne</td></tr>'}</tbody>
  </table>

  ${sigBlock}
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Fiche de prêt' });
}
