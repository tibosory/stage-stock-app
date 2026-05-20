import { Alert } from 'react-native';
import { updateTourUseCase } from '../application/usecases';
import type { Tour } from '../types';
import { tRuntime } from '../i18n/runtime';

/**
 * Menus Alert pour faire évoluer le cycle planifiée → en cours → terminée,
 * sans dupliquer la logique entre liste et détail.
 */
export function showTourLifecycleMenu(tour: Tour, onUpdated: () => void): void {
  const todayIso = new Date().toISOString().slice(0, 10);
  const run = (payload: Parameters<typeof updateTourUseCase>[0]) => {
    void updateTourUseCase(payload)
      .then(onUpdated)
      .catch((e: unknown) => Alert.alert(tRuntime('tour.lifecycle.updateError'), e instanceof Error ? e.message : String(e)));
  };

  const st = tour.status;
  const buttons: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];

  if (st === 'planned') {
    buttons.push({
      text: tRuntime('tour.lifecycle.toActive'),
      onPress: () => run({ tourId: tour.id, status: 'active' }),
    });
    buttons.push({
      text: tRuntime('tour.lifecycle.toCompletedClose'),
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          tRuntime('tour.lifecycle.confirmCloseTitle'),
          tRuntime('tour.lifecycle.confirmCloseBody'),
          [
            { text: tRuntime('common.cancel'), style: 'cancel' },
            { text: tRuntime('tour.lifecycle.close'), style: 'destructive', onPress: () => run({ tourId: tour.id, status: 'completed', endDate: todayIso }) },
          ]
        );
      },
    });
  } else if (st === 'active') {
    buttons.push({
      text: tRuntime('tour.lifecycle.toCompleted'),
      onPress: () => {
        Alert.alert(tRuntime('tour.lifecycle.confirmCompleteTitle'), `${tRuntime('tour.lifecycle.confirmCompleteBodyPrefix')} ${todayIso}.`, [
          { text: tRuntime('common.cancel'), style: 'cancel' },
          { text: tRuntime('tour.lifecycle.complete'), onPress: () => run({ tourId: tour.id, status: 'completed', endDate: todayIso }) },
        ]);
      },
    });
    buttons.push({
      text: tRuntime('tour.lifecycle.toPlanned'),
      onPress: () => run({ tourId: tour.id, status: 'planned', endDate: null }),
    });
  } else {
    buttons.push({
      text: tRuntime('tour.lifecycle.reopenActive'),
      onPress: () => run({ tourId: tour.id, status: 'active', endDate: null }),
    });
    buttons.push({
      text: tRuntime('tour.lifecycle.toPlanned'),
      onPress: () => run({ tourId: tour.id, status: 'planned', endDate: null }),
    });
  }
  buttons.push({ text: tRuntime('common.cancel'), style: 'cancel' });

  Alert.alert(tRuntime('tour.lifecycle.menuTitle'), `${tour.name}\n\n${tRuntime('tour.lifecycle.menuBody')}`, buttons);
}
