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
  listApOrganizationDocuments,
  saveDocument,
} from '../../db/accueilProDb';
import { uploadAccueilProOrganizationDocument } from '../../lib/accueilProOrgDocumentUpload';
import { resolveAccueilProSyncEndpoint, syncAccueilProBidirectional } from '../../lib/accueilProApiSync';
import { logAccueilProAction } from '../../lib/accueilProActivityLog';
import { useLanguage } from '../../context/LanguageContext';
import { useAppAuth } from '../../context/AuthContext';
import { useConnection } from '../../context/ConnectionContext';

const DOC_CATEGORIES = ['assurance', 'programme', 'rider', 'liste', 'technique', 'contrat', 'autre'] as const;

type Props = {
  organizationId: string | null;
  onEnsureOrganizationId: () => Promise<string | null>;
  onDocumentsChange: (docs: ApOrganizationDocument[]) => void;
};

type PickedFile = { uri: string; name: string; mime: string };

function docPickFiles(pick: DocumentPicker.DocumentPickerResult): PickedFile[] {
  if (pick.canceled) return [];
  return (pick.assets ?? [])
    .filter(a => Boolean(a?.uri))
    .map(a => ({
      uri: a.uri,
      name: a.name?.trim() || 'document',
      mime: a.mimeType?.trim() || 'application/octet-stream',
    }));
}

function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'Document';
}

export function OrganizationDocumentsSection(props: Props) {
  const { organizationId, onEnsureOrganizationId, onDocumentsChange } = props;
  const { t } = useLanguage();
  const { user } = useAppAuth();
  const { status: connStatus } = useConnection();
  const [docs, setDocs] = useState<ApOrganizationDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('assurance');

  const reload = useCallback(async () => {
    if (!organizationId) {
      setDocs([]);
      onDocumentsChange([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listApOrganizationDocuments(organizationId);
      setDocs(rows);
      onDocumentsChange(rows);
    } finally {
      setLoading(false);
    }
  }, [organizationId, onDocumentsChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onPickAndUpload = async () => {
    let orgId = organizationId;
    if (!orgId) {
      orgId = await onEnsureOrganizationId();
      if (!orgId) {
        Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.documents.needOrg'));
        return;
      }
    }

    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      const files = docPickFiles(pick);
      if (!files.length) return;

      const sharedTitle = title.trim();
      const docCategory = category === 'autre' ? null : category;
      setUploading(true);

      let ok = 0;
      for (const file of files) {
        const docTitle =
          (files.length === 1 ? sharedTitle : '') ||
          fileBaseName(file.name);

        const localId = generateApId();
        const row: ApOrganizationDocument = {
          id: localId,
          organization_id: orgId,
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
              organizationId: orgId,
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

        void logAccueilProAction({
          action: 'document.added',
          entity: 'organization_document',
          entityId: orgId,
          summary: `Document ajouté : ${docTitle}`,
          actorName: user?.nom,
        });
        ok += 1;
      }

      setTitle('');
      await reload();
      Alert.alert(
        t('accueilpro.documents.addedTitle'),
        ok > 1
          ? t('accueilpro.portal.eventDocsAddedMany', { count: ok })
          : t('accueilpro.documents.addedBody')
      );
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
      <Text style={apStyles.sectionTitle}>{t('accueilpro.documents.title')}</Text>
      <Text style={apStyles.hint}>{t('accueilpro.documents.hint')}</Text>

      {!organizationId ?
        <Text style={[apStyles.hint, { marginTop: 8 }]}>{t('accueilpro.documents.needOrg')}</Text>
      : null}

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
            label={t(`accueilpro.documents.category.${cat}`)}
            selected={category === cat}
            onPress={() => setCategory(cat)}
          />
        ))}
      </View>

      <AccueilProPrimaryButton
        label={t('accueilpro.portal.pickAnyFiles')}
        onPress={() => void onPickAndUpload()}
        loading={uploading}
      />
      <AccueilProPrimaryButton
        style={{ marginTop: 10 }}
        label={t('accueilpro.documents.refresh')}
        onPress={() => void reload()}
        loading={loading}
      />

      {docs.length === 0 ?
        <Text style={[apStyles.hint, { marginTop: 14 }]}>{t('accueilpro.documents.empty')}</Text>
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
                {[doc.category, doc.synced ? t('accueilpro.documents.synced') : t('accueilpro.documents.pending')]
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
