import assert from 'node:assert/strict';
import { buildLocalPdfPreviewHtml } from '../lib/localPdfPreviewHtml';

const html = buildLocalPdfPreviewHtml('YWJj');

assert.ok(html.includes('pdf.min.js'), 'pdf.js requis');
assert.ok(html.includes('pdf.worker.min.js'), 'worker pdf.js requis');
assert.ok(html.includes('getDocument'), 'rendu canvas attendu');
assert.ok(html.includes('YWJj'), 'base64 injecté');
assert.ok(!html.includes('<embed'), 'embed natif retiré');

console.log('local-pdf-webview.spec.ts OK');
