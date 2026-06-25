import assert from 'node:assert/strict';
import {
  bulkQrItemFromConsommable,
  bulkQrItemFromMateriel,
  consommableReferenceDisplay,
  fitQrLabelLayout,
  formatReferenceLine,
} from '../lib/labelQrLayout';

function run() {
  assert.equal(formatReferenceLine('ABC-12'), 'Réf. ABC-12');
  assert.equal(formatReferenceLine(''), 'Réf. —');

  const matItem = bulkQrItemFromMateriel({
    id: 'm1',
    nom: 'Projecteur LED',
    qr_code: 'PRJ-001',
  } as any);
  assert.equal(matItem.metaLine, 'Réf. PRJ-001');

  const consoItem = bulkQrItemFromConsommable({
    id: 'c1',
    nom: 'Gel',
    reference: 'GEL-42',
    qr_code: 'QR-GEL',
  } as any);
  assert.equal(consoItem.metaLine, 'Réf. GEL-42');
  assert.equal(consommableReferenceDisplay({ id: 'c1', reference: '', qr_code: 'QR-GEL' }), 'QR-GEL');

  const tiny = fitQrLabelLayout({
    innerWmm: 38,
    innerHmm: 21,
    nom: 'Nom très long pour une petite étiquette Avery',
    refLine: 'Réf. REFERENCE-LONGUE-12345',
  });
  assert.ok(tiny.namePt >= 3.5);
  assert.ok(tiny.refPt >= 3.2);
  assert.ok(tiny.qrMm >= 8);

  const longName = fitQrLabelLayout({
    innerWmm: 70,
    innerHmm: 36,
    nom: 'Article avec un libellé extrêmement long qui doit tenir sans être coupé sur l’étiquette',
    refLine: 'Réf. X',
  });
  assert.ok(longName.namePt <= 12);
  assert.ok(longName.qrMm <= 48);

  console.log('label-qr-layout.spec: OK');
}

run();
