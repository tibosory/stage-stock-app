import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  AccueilProChip,
  AccueilProFormCard,
  AccueilProInput,
  AccueilProPrimaryButton,
  AccueilProColors,
  apStyles,
} from './AccueilProUI';
import type { ApOrganizationDocument } from '../../types/accueilPro';
import {
  deleteDocument,
  generateApId,
  listApOrganizationDocumentsByEvent,
  saveDocument,
} from '../../db/accueilProDb';
import { uploadAccueilProOrganizationDocument } from '../../lib/accueilProOrgDocumentUpload';
import { resolveAccueilProSyncEndpoint, syncAccueilProBidirectional } from '../../lib/accueilProApiSync';
import { logAccueilProAction } from '../../lib/accueilProActivityLog';
import { useLanguage } from '../../context/LanguageContext';
import { useAppAuth } from '../../context/AuthContext';
import { useConnection } from '../../context/ConnectionContext';

const DOC_CATEGORIES = ['programme', 'rider', 'liste', 'audio', 'video', 'autre'] as const;

type PickKind = 'pdf' | 'audio' | 'video';

type Props = {
  organizationId: string;
  eventId: string;
  onDocumentsChange?: (docs: ApOrganizationDocument[]) => void;
};

function docPickUri(pick: DocumentPicker.DocumentPickerResult): { uri: string; name: string; mime: string } | null {
  if (pick.canceled) return null;
  const asset = pick.assets?.[0];
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    name: asset.name ?? 'document',
    mime: asset.mimeType ?? 'application/octet-stream',
  };
}

function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'Document';
}

function mimeLabel(mime?: string | null): string {
  if (!mime) return '—';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.startsWith('video/')) return 'Vidéo';
  return mime.split('/').pop() ?? mime;
}

export function EventDocumentsSection(props: Props) {
  const { organizationId, eventId, onDocumentsChange } = props;
  const { t } = useLanguage();
  const { user } = useAppAuth();
  const { status: connStatus } = useConnection();
  const [docs, setDocs] = useState<ApOrganizationDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('programme');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listApOrganizationDocumentsByEvent(eventId);
      setDocs(rows);
      onDocumentsChange?.(rows);
    } finally {
      setLoading(false);
    }
  }, [eventId, onDocumentsChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onPick = async (kind: PickKind) => {
    const type =
      kind === 'pdf' ? 'application/pdf'
      : kind === 'audio' ? 'audio/*'
      : 'video/*';

    try {
      const pick = await DocumentPicker.getDocumentAsync({ type, copyToCacheDirectory: true });
      const file = docPickUri(pick);
      if (!file) return;

      const docTitle = title.trim() || fileBaseName(file.name);
      const docCategory = category === 'autre' ? null : category;
      setUploading(true);

      const localId = generateApId();
      const row: ApOrganizationDocument = {
        id: localId,
        organization_id: organizationId,
        event_id: eventId,
        title: docTitle,
        category: docCategory,
        local_uri: file.uri,
        mime_type: file.mime,
        synced: false,
        created_at: new Date().toISOString(),
      };
      await saveDocument(row);

      if (connStatus === 'ok') {
        const endpoint = await resolveAccueilProSyncEndpoint();
        if (endpoint) {
          const res = await uploadAccueilProOrganizationDocument({
            organizationId,
            eventId,
            fileUri: file.uri,
            title: docTitle,
            category: docCategory ?? undefined,
            mimeType: file.mime,
            filename: file.name,
            endpoint,
          });
          if (res.ok) {
            const json = (await res.json()) as { id?: string; path?: string };
            const serverId = json.id?.trim() || localId;
            if (serverId !== localId) {
              await deleteDocument(localId);
            }
            await saveDocument({
              ...row,
              id: serverId,
              storage_path: json.path ?? null,
              synced: true,
            });
            try {
              await syncAccueilProBidirectional(endpoint);
            } catch {
              /* local copy ok */
            }
          }
        }
      }

      setTitle('');
      await reload();
      void logAccueilProAction({
        action: 'document.added',
        entity: 'event_document',
        entityId: eventId,
        summary: `Document événement : ${docTitle}`,
        actorName: user?.nom,
      });
      Alert.alert(t('accueilpro.documents.addedTitle'), t('accueilpro.documents.addedBody'));
    } catch (e) {
      Alert.alert(t('accueilpro.orgs.errTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const onDelete = (doc: ApOrganizationDocument) => {
    Alert.alert(t('accueilpro.documents.deleteTitle'), doc.title, [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.documents.deleteCta'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteDocument(doc.id);
            await reload();
          })();
        },
      },
    ]);
  };

  return (
    <AccueilProFormCard>
      <Text style={apStyles.sectionTitle}>{t('accueilpro.portal.eventDocsTitle')}</Text>
      <Text style={apStyles.hint}>{t('accueilpro.portal.eventDocsHint')}</Text>

      <AccueilProInput
        label={t('accueilpro.documents.fieldTitle')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('accueilpro.documents.titlePlaceholder')}
      />
      <Text style={apStyles.label}>{t('accueilpro.documents.fieldCategory')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {DOC_CATEGORIES.map(cat => (
          <AccueilProChip
            key={cat}
            label={t(`accueilpro.portal.eventDocCategory.${cat}`)}
            selected={category === cat}
            onPress={() => setCategory(cat)}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <AccueilProPrimaryButton
          style={{ flex: 1, minWidth: 100 }}
          label={t('accueilpro.portal.pickPdf')}
          onPress={() => void onPick('pdf')}
          loading={uploading}
        />
        <AccueilProPrimaryButton
          style={{ flex: 1, minWidth: 100 }}
          label={t('accueilpro.portal.pickAudio')}
          onPress={() => void onPick('audio')}
          loading={uploading}
        />
        <AccueilProPrimaryButton
          style={{ flex: 1, minWidth: 100 }}
          label={t('accueilpro.portal.pickVideo')}
          onPress={() => void onPick('video')}
          loading={uploading}
        />
      </View>
      <AccueilProPrimaryButton
        style={{ marginTop: 10 }}
        label={t('accueilpro.documents.refresh')}
        onPress={() => void reload()}
        loading={loading}
      />

      {docs.length === 0 ?
        <Text style={[apStyles.hint, { marginTop: 14 }]}>{t('accueilpro.portal.eventDocsEmpty')}</Text>
      : (
        <View style={{ marginTop: 14, gap: 10 }}>
          {docs.map(doc => (
            <View
              key={doc.id}
              style={{
                borderWidth: 1,
                borderColor: AccueilProColors.borderSubtle,
                borderRadius: 10,
                padding: 12,
              }}
            >
              <Text style={apStyles.rowTitle}>{doc.title}</Text>
              <Text style={apStyles.rowMeta}>
                {[mimeLabel(doc.mime_type), doc.category, doc.synced ? t('accueilpro.documents.synced') : t('accueilpro.documents.pending')]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <TouchableOpacity onPress={() => onDelete(doc)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[apStyles.actionNo, { marginTop: 8 }]}>{t('accueilpro.documents.deleteCta')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </AccueilProFormCard>
  );
}
