import assert from 'node:assert/strict';
import type { Materiel } from '../types';
import {
  buildPretMaterielNameGroups,
  buildQtyByNameKeyFromMaterielIds,
  buildQtyByNameKeyFromPretLignes,
  expandPretNameQtyToLignes,
  lotPretGroupKey,
} from '../lib/pretMaterielGroups';

function unit(partial: Partial<Materiel> & { id: string; nom: string }): Materiel {
  return {
    categorie_id: undefined,
    localisation_id: undefined,
    statut: 'en stock',
    etat: 'bon',
    gestion_lot: 0,
    stock_actuel: 1,
    created_at: '',
    updated_at: '',
    synced: false,
    ...partial,
  } as Materiel;
}

function lot(partial: Partial<Materiel> & { id: string; nom: string; stock_actuel: number }): Materiel {
  return unit({
    gestion_lot: 1,
    unite: 'pièce',
    ...partial,
  });
}

function testLotAvailableUsesStockMinusReserved() {
  const groups = buildPretMaterielNameGroups(
    [lot({ id: 'l1', nom: 'Collier ortho', stock_actuel: 20 })],
    { l1: 5 }
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].isLot, true);
  assert.equal(groups[0].available, 15);
  assert.equal(groups[0].key, lotPretGroupKey('l1'));
}

function testExpandLotWritesSingleLineWithQty() {
  const groups = buildPretMaterielNameGroups([
    lot({ id: 'l1', nom: 'Collier ortho', stock_actuel: 20 }),
    unit({ id: 'u1', nom: 'Projecteur' }),
    unit({ id: 'u2', nom: 'Projecteur' }),
  ]);
  const lignes = expandPretNameQtyToLignes(groups, {
    [lotPretGroupKey('l1')]: 10,
    projecteur: 2,
  });
  assert.deepEqual(lignes, [
    { materielId: 'l1', quantite: 10 },
    { materielId: 'u1', quantite: 1 },
    { materielId: 'u2', quantite: 1 },
  ]);
}

function testScanAndDemandeQtyRestore() {
  const mats = [lot({ id: 'l1', nom: 'Collier ortho', stock_actuel: 20 })];
  const groups = buildPretMaterielNameGroups(mats);
  const fromScan = buildQtyByNameKeyFromMaterielIds(mats, ['l1']);
  assert.equal(fromScan[lotPretGroupKey('l1')], 1);
  const fromLignes = buildQtyByNameKeyFromPretLignes(groups, [
    { materiel_id: 'l1', quantite: 10, materiel_nom: 'Collier ortho' },
  ]);
  assert.equal(fromLignes[lotPretGroupKey('l1')], 10);
}

function testLotWithZeroAvailableHidden() {
  const groups = buildPretMaterielNameGroups(
    [lot({ id: 'l1', nom: 'Collier', stock_actuel: 3 })],
    { l1: 3 }
  );
  assert.equal(groups.length, 0);
}

function run() {
  testLotAvailableUsesStockMinusReserved();
  testExpandLotWritesSingleLineWithQty();
  testScanAndDemandeQtyRestore();
  testLotWithZeroAvailableHidden();
  console.log('pret-materiel-groups.spec: OK');
}

void run();
