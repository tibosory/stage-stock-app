import assert from 'node:assert/strict';
import { mergeMaterielLocalMedia, filterSnapshotRowsByUnsyncedIds } from '../lib/inventorySnapshotMerge';

function run() {
  const remote = {
    id: 'm-1',
    nom: 'Projecteur',
    photo_url: 'https://cdn.example/photo.jpg',
    photo_local: null,
    notice_pdf_local: null,
    notice_photo_local: null,
  };

  const withLocal = mergeMaterielLocalMedia(remote, {
    photo_local: 'file:///data/photo.jpg',
    notice_pdf_local: 'file:///data/notice.pdf',
    notice_photo_local: null,
  });

  assert.equal(withLocal.photo_local, 'file:///data/photo.jpg');
  assert.equal(withLocal.notice_pdf_local, 'file:///data/notice.pdf');
  assert.equal(withLocal.nom, 'Projecteur');
  assert.equal(withLocal.photo_url, 'https://cdn.example/photo.jpg');

  const remoteHasLocal = mergeMaterielLocalMedia(
    { ...remote, photo_local: 'file:///remote/copy.jpg' },
    { photo_local: 'file:///data/photo.jpg' }
  );
  assert.equal(remoteHasLocal.photo_local, 'file:///remote/copy.jpg');

  const noLocal = mergeMaterielLocalMedia(remote, null);
  assert.equal(noLocal.photo_local, null);

  const emptyStrings = mergeMaterielLocalMedia(remote, {
    photo_local: '   ',
    notice_pdf_local: '',
  });
  assert.equal(emptyStrings.photo_local, null);

  const rows = [
    { id: 'a', nom: 'A' },
    { id: 'b', nom: 'B' },
    { id: 'c', nom: 'C' },
  ];
  const filtered = filterSnapshotRowsByUnsyncedIds(rows, new Set(['b']));
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map(r => r.id), ['a', 'c']);

  const unchanged = filterSnapshotRowsByUnsyncedIds(rows, new Set());
  assert.equal(unchanged.length, 3);

  console.log('inventory-snapshot-merge.spec: OK');
}

run();
