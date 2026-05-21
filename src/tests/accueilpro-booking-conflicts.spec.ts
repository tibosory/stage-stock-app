import assert from 'node:assert/strict';
import {
  bookingRangesOverlap,
  bookingTimeRangeMs,
} from '../lib/accueilProBookingConflicts';

function range_sameDay_withTimes() {
  const a = bookingTimeRangeMs({ dateDebut: '2026-06-01', heureDebut: '14:00', heureFin: '18:00' });
  const b = bookingTimeRangeMs({ dateDebut: '2026-06-01', heureDebut: '16:00', heureFin: '20:00' });
  assert.ok(a && b);
  assert.equal(bookingRangesOverlap(a, b), true);
  console.log('  ✓ overlap same day times');
}

function range_sameDay_noOverlap() {
  const a = bookingTimeRangeMs({ dateDebut: '2026-06-01', heureDebut: '09:00', heureFin: '12:00' });
  const b = bookingTimeRangeMs({ dateDebut: '2026-06-01', heureDebut: '14:00', heureFin: '18:00' });
  assert.ok(a && b);
  assert.equal(bookingRangesOverlap(a, b), false);
  console.log('  ✓ no overlap same day');
}

function range_multiDay_overlap() {
  const a = bookingTimeRangeMs({ dateDebut: '2026-06-01', dateFin: '2026-06-03', heureDebut: '10:00', heureFin: '22:00' });
  const b = bookingTimeRangeMs({ dateDebut: '2026-06-02', heureDebut: '08:00', heureFin: '12:00' });
  assert.ok(a && b);
  assert.equal(bookingRangesOverlap(a, b), true);
  console.log('  ✓ overlap multi-day');
}

function range_invalid_returnsNull() {
  assert.equal(bookingTimeRangeMs({ dateDebut: '' }), null);
  console.log('  ✓ invalid date returns null');
}

console.log('accueilpro-booking-conflicts.spec.ts');
range_sameDay_withTimes();
range_sameDay_noOverlap();
range_multiDay_overlap();
range_invalid_returnsNull();
console.log('OK accueilpro-booking-conflicts');
