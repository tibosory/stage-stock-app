import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ApConvention } from '../types/accueilPro';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Partage le PDF importé ou génère une attestation HTML si absent. */
export async function exportAccueilProConventionPdf(convention: ApConvention, eventName?: string | null): Promise<void> {
  const localPdf = convention.document_local_uri?.trim();
  if (localPdf) {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localPdf, {
        mimeType: 'application/pdf',
        dialogTitle: `Convention — ${convention.titre}`,
      });
    }
    return;
  }

  const sigBlock =
    convention.signature_data?.trim()
      ? `<div class="sig"><p class="sig-title"><strong>Signature</strong> — ${esc(convention.signed_by ?? '—')} · ${esc(convention.signed_at?.slice(0, 16) ?? '')}</p><img class="sig-img" src="data:image/png;base64,${convention.signature_data.trim()}" alt="Signature" /></div>`
      : '<p class="muted">Non signée</p>';

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
<style>
body{font-family:system-ui,sans-serif;color:#1A2744;padding:32px;font-size:13px;line-height:1.5}
h1{font-size:22px;margin:0 0 8px} .sub{color:#888;font-size:12px;margin-bottom:20px}
.body{white-space:pre-wrap;background:#F7F4EE;border-radius:8px;padding:16px;min-height:80px}
.sig{margin-top:24px;border-top:1px solid #E5E0D4;padding-top:16px}
.sig-img{max-width:280px;max-height:120px;border:1px solid #ccc;background:#fff}
.muted{color:#888}
</style></head><body>
<h1>${esc(convention.titre)}</h1>
<p class="sub">${eventName ? `Événement : ${esc(eventName)} · ` : ''}Statut : ${esc(convention.status)} · généré ${esc(new Date().toLocaleString('fr-FR'))}</p>
<div class="body">${esc(convention.contenu?.trim() || '—')}</div>
${sigBlock}
<p style="margin-top:32px;font-size:11px;color:#999">Accueil Pro — convention interne</p>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Convention — ${convention.titre}`,
    });
  }
}
