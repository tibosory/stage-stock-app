import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Switch, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Shadow } from '../theme/colors';
import { Card } from './UI';
import { useAppAuth } from '../context/AuthContext';
import { syncToInventoryApi, syncFromInventoryApi } from '../lib/inventoryApiSync';
import { getConsommablesAlerte, getMateriel } from '../db/database';
import { rescheduleVgpDueReminders } from '../lib/vgpNotifications';
import { rescheduleSeuilBasReminders } from '../lib/seuilNotifications';
import { isConsumerApp } from '../config/appMode';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  getSyncAfterEachActionEnabled,
  setSyncAfterEachActionEnabled,
} from '../lib/syncAfterAction';

export function NetworkCloudSync() {
  const { can, refreshSession } = useAppAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncAfterEachAction, setSyncAfterEachAction] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getSyncAfterEachActionEnabled().then(setSyncAfterEachAction);
    }, [])
  );

  const handleSync = async (direction: 'push' | 'pull') => {
    setSyncing(true);
    const fn = direction === 'push' ? syncToInventoryApi : syncFromInventoryApi;
    const result = await fn();
    setSyncing(false);
    if (result.ok) {
      await refreshSession();
      const [m, seuils] = await Promise.all([getMateriel(), getConsommablesAlerte()]);
      await rescheduleVgpDueReminders(m);
      await rescheduleSeuilBasReminders(seuils);
      Alert.alert(
        '✓ Sync réussie',
        direction === 'push' ? 'Données envoyées vers le cloud' : 'Données reçues depuis le cloud'
      );
    } else {
      Alert.alert('Erreur sync', result.error ?? 'Erreur inconnue');
    }
  };

  if (!can('params_sync')) return null;

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Synchro après chaque action</Text>
            <Text style={styles.hint}>
              Après enregistrement (prêt, matériel, consommable, VGP, etc.), envoi puis réception automatiques si le
              serveur répond.
            </Text>
          </View>
          <Switch
            value={syncAfterEachAction}
            onValueChange={async v => {
              await setSyncAfterEachActionEnabled(v);
              setSyncAfterEachAction(v);
            }}
            trackColor={{ false: Colors.border, true: Colors.greenMuted }}
            thumbColor={syncAfterEachAction ? Colors.green : Colors.textMuted}
          />
        </View>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 16 }}>☁️</Text>
          <Text style={styles.cardTitle}>Synchronisation cloud (API)</Text>
        </View>
        {syncing ? (
          <ActivityIndicator color={Colors.green} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => void handleSync('push')}>
              <Text style={styles.primaryBtnText}>↑ Envoyer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { flex: 1 }]}
              onPress={() => void handleSync('pull')}
            >
              <Text style={styles.secondaryBtnText}>↓ Recevoir</Text>
            </TouchableOpacity>
          </View>
        )}
        {isConsumerApp() ? (
          <>
            <Text style={[styles.hintMuted, { marginTop: 10 }]}>
              Envoyez vos modifications vers le service, ou récupérez les données depuis le service.
            </Text>
            <Text style={styles.hintMuted}>
              Une synchro est aussi lancée automatiquement à l’ouverture de l’app si le serveur est joignable.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.hintMuted, { marginTop: 10 }]}>
              Même URL que ci-dessus (build ou surcharge sur cet appareil). ↑ envoie les lignes locales ; ↓ récupère le
              snapshot serveur. Comptes utilisateurs (PIN) : seul un administrateur les envoie (↑) ; les autres
              téléphones les reçoivent (↓). Les jetons de notification push restent locaux à chaque appareil.
            </Text>
            <Text style={styles.hintMuted}>
              À chaque retour au premier plan, l’app tente aussi envoi puis réception (silencieux en cas d’échec).
            </Text>
          </>
        )}
        {isSupabaseConfigured() && !isConsumerApp() ? (
          <Text style={[styles.hintMuted, { marginTop: 8 }]}>
            Notices PDF / photo : Supabase optionnel pour l’upload (écran Utilisateur).
          </Text>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  hintMuted: { color: Colors.textMuted, fontSize: 11, lineHeight: 17 },
  primaryBtn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadow.card,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.greenMuted,
  },
  secondaryBtnText: { color: Colors.green, fontWeight: '600', fontSize: 15 },
});
