/**
 * Notice utilisateur complète au format PDF (HTML → expo-print).
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getUserGuideForLanguage } from '../content/userGuideLocale';
import type { AppLanguage } from '../i18n/strings';
import { tForLanguage } from '../i18n/strings';
import { getStoredAppLanguage } from './appLanguageStorage';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escWithBreaks(s: string): string {
  return esc(s).replace(/\r?\n/g, '<br/>');
}

function sectionAnchorId(index: number): string {
  return `sec-${index + 1}`;
}

function buildHtml(lang: AppLanguage): string {
  const { meta: USER_GUIDE_META, sections: USER_GUIDE_SECTIONS } = getUserGuideForLanguage(lang);
  const htmlLang = lang === 'fr' ? 'fr' : 'en';
  const tocTitle = tForLanguage(lang, 'pdf.notice.toc');
  const coverGen = tForLanguage(lang, 'pdf.notice.coverGenerated');
  const exLab = tForLanguage(lang, 'pdf.notice.example');
  const footerTxt = tForLanguage(lang, 'pdf.notice.footer');

  const sectionsHtml = USER_GUIDE_SECTIONS.map(
    (sec, index) =>
      `<section class="sec" id="${sectionAnchorId(index)}">
        <h2><span class="ico">${esc(sec.icon)}</span> ${esc(sec.title)}</h2>
        ${sec.paragraphs.map(p => `<p>${escWithBreaks(p)}</p>`).join('')}
        ${(sec.examples ?? [])
          .map(
            e =>
              `<div class="ex"><span class="exlab">${esc(exLab)}</span> ${esc(e)}</div>`
          )
          .join('')}
      </section>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8" />
  <title>${esc(USER_GUIDE_META.title)}</title>
  <style>
    @page { margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: #18181b;
      margin: 0;
    }
    .cover {
      text-align: center;
      padding: 28mm 12mm 20mm;
      border-bottom: 3px solid #059669;
      margin-bottom: 10mm;
    }
    .cover h1 { font-size: 22pt; margin: 0 0 8px; color: #065f46; }
    .cover .sub { font-size: 12pt; color: #3f3f46; margin: 0 0 6px; }
    .cover .ver { font-size: 9pt; color: #71717a; margin-top: 12px; }
    .toc { margin-bottom: 12mm; page-break-after: always; }
    .toc h2 { font-size: 13pt; color: #065f46; margin-bottom: 8px; }
    .toc ol { margin: 0; padding-left: 18px; }
    .toc li { margin-bottom: 4px; }
    .toc a {
      color: #065f46;
      text-decoration: none;
    }
    .toc a:hover,
    .toc a:active {
      text-decoration: underline;
    }
    .sec { margin-bottom: 10mm; page-break-inside: avoid; }
    .sec h2 {
      font-size: 12pt;
      color: #047857;
      border-bottom: 1px solid #d1fae5;
      padding-bottom: 4px;
      margin: 0 0 8px;
    }
    .ico { font-style: normal; margin-right: 4px; }
    p { margin: 0 0 7px; text-align: justify; hyphens: auto; }
    .ex {
      background: #ecfdf5;
      border-left: 4px solid #34d399;
      padding: 8px 10px;
      margin-top: 8px;
      font-size: 9.8pt;
    }
    .exlab {
      display: inline-block;
      font-weight: 800;
      color: #047857;
      margin-right: 6px;
    }
    footer {
      margin-top: 14mm;
      font-size: 8pt;
      color: #71717a;
      text-align: center;
      border-top: 1px solid #e4e4e7;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${esc(USER_GUIDE_META.title)}</h1>
    <p class="sub">${esc(USER_GUIDE_META.subtitle)}</p>
    <p class="ver">${esc(coverGen)} ${esc(USER_GUIDE_META.versionLabel)}</p>
  </div>
  <nav class="toc">
    <h2>${esc(tocTitle)}</h2>
    <ol>
      ${USER_GUIDE_SECTIONS.map((s, i) => `<li><a href="#${sectionAnchorId(i)}">${esc(s.title)}</a></li>`).join('')}
    </ol>
  </nav>
  ${sectionsHtml}
  <footer>
    ${esc(footerTxt)}
  </footer>
</body>
</html>`;
}

/** Génère un PDF du manuel et ouvre le partage système (enregistrer dans Fichiers, envoyer…). */
export async function exportShareUserGuidePdf(langHint?: AppLanguage): Promise<void> {
  const stored = langHint ?? (await getStoredAppLanguage());
  const lang: AppLanguage = stored ?? 'fr';
  const { meta } = getUserGuideForLanguage(lang);
  const html = buildHtml(lang);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const can = await Sharing.isAvailableAsync();
  if (!can) {
    throw new Error(tForLanguage(lang, 'notice.pdf.shareUnavailable'));
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: meta.title,
    UTI: 'com.adobe.pdf',
  });
}
