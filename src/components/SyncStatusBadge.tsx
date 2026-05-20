import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSyncState } from '../ui/hooks/useSyncState';
import { Colors } from '../theme/colors';
import { triggerSyncNow } from '../application/sync/SyncScheduler';
import { appendSyncAdminAuditEntry } from '../application/sync/SyncAdminAuditStore';
import { useAppAuth } from '../context/AuthContext';

function colorForPhase(phase: string): string {
  if (phase === 'success') return Colors.green;
  if (phase === 'error') return Colors.red;
  if (phase === 'running') return Colors.blue;
  return Colors.textMuted;
}

export function SyncStatusBadge() {
  const sync = useSyncState();
  const { user } = useAppAuth();
  const label =
    sync.phase === 'running'
      ? 'Sync en cours'
      : sync.phase === 'success'
        ? 'Sync OK'
        : sync.phase === 'error'
          ? 'Sync erreur'
          : 'Sync idle';

  return (
    <View style={s.row}>
      <View style={[s.dot, { backgroundColor: colorForPhase(sync.phase) }]} />
      <Text style={s.text}>{label}</Text>
      <TouchableOpacity
        onPress={() =>
          void triggerSyncNow()
            .then(() =>
              appendSyncAdminAuditEntry({
                action: 'force_sync',
                userId: user?.id,
                summary: 'Force sync triggered from badge',
              })
            )
            .catch(() => undefined)
        }
        style={s.btn}
      >
        <Text style={s.btnText}>Forcer</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgCardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 8 },
  text: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  btn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700' },
});
