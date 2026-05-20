import type { AssignmentStatus, TourStatus } from '../types';
import { Colors } from '../theme/colors';
import { tRuntime } from '../i18n/runtime';

/** Libellés courts pour l’interface (tournées / tracking). */
export function tourStatusLabel(status: TourStatus): string {
  switch (status) {
    case 'planned':
      return tRuntime('tour.status.planned');
    case 'active':
      return tRuntime('tour.status.active');
    case 'completed':
      return tRuntime('tour.status.completed');
    default:
      return status;
  }
}

/** Libellés compréhensibles pour le suivi d’une pièce sur une tournée. */
export function assignmentStatusLabel(status: AssignmentStatus): string {
  switch (status) {
    case 'assigned':
      return tRuntime('assignment.status.assigned');
    case 'in_use':
      return tRuntime('assignment.status.in_use');
    case 'returned':
      return tRuntime('assignment.status.returned');
    case 'lost':
      return tRuntime('assignment.status.lost');
    case 'damaged':
      return tRuntime('assignment.status.damaged');
    default:
      return status;
  }
}

/** Phrase d’aide pour l’utilisateur (bulle / notice). */
export function assignmentStatusHint(status: AssignmentStatus): string {
  switch (status) {
    case 'assigned':
      return tRuntime('assignment.hint.assigned');
    case 'in_use':
      return tRuntime('assignment.hint.in_use');
    case 'returned':
      return tRuntime('assignment.hint.returned');
    case 'lost':
      return tRuntime('assignment.hint.lost');
    case 'damaged':
      return tRuntime('assignment.hint.damaged');
    default:
      return '';
  }
}

export function assignmentStatusColor(status: AssignmentStatus): string {
  switch (status) {
    case 'assigned':
      return Colors.blue;
    case 'in_use':
      return Colors.green;
    case 'returned':
      return Colors.textMuted;
    case 'lost':
      return Colors.red;
    case 'damaged':
      return Colors.yellow;
    default:
      return Colors.textSecondary;
  }
}

export function tourStatusColor(status: TourStatus): string {
  switch (status) {
    case 'planned':
      return Colors.blue;
    case 'active':
      return Colors.green;
    case 'completed':
      return Colors.textMuted;
    default:
      return Colors.textSecondary;
  }
}
