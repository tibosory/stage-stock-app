import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { AccueilProFormCard, AccueilProScreenLayout, apStyles } from '../../components/accueilpro/AccueilProUI';
import { AccueilProPdfPreviewModal } from '../../components/accueilpro/AccueilProPdfPreviewModal';
import { useLanguage } from '../../context/LanguageContext';
import { listApCapiDocumentRefs } from '../../db/capiAccueilProRefDb';
import type { ApCapiDocumentRef } from '../../types/accueilPro';
import { downloadCapiAccueilProDocumentToCache, resolveCapiBridgeApiBase } from '../../lib/capiAccueilProApi';
import { getApiKeyOverride } from '../../lib/apiEndpointStorage';

export default function AccueilProCapiDocumentsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const spectacleRefId = route.params?.spectacleRefId as string;
  const eventName = (route.params?.eventName as string | undefined) ?? t('accueilpro.events.title');
  const [docs, setDocs] = useState<ApCapiDocumentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void listApCapiDocumentRefs(spectacleRefId)
        .then((rows) => {
          const score = (d: ApCapiDocumentRef) => {
            const n = `${d.nom} ${d.cheminDossier ?? ''} ${d.pole ?? ''}`.toLowerCase();
            let s = 0;
            if (d.pole === 'PLAN') s += 40;
            if (d.pole === 'GENERAL') s += 20;
            if (/accueil|feuille.?route|plan\b|technique/.test(n)) s += 30;
            if (n.endsWith('.pdf') || (d.mimeType ?? '').includes('pdf')) s += 5;
            return s;
          };
          setDocs([...rows].sort((a, b) => score(b) - score(a) || a.nom.localeCompare(b.nom, 'fr')));
        })
        .finally(() => setLoading(false));
    }, [spectacleRefId]),
  );

  const openDoc = async (doc: ApCapiDocumentRef) => {
    const apiBase = await resolveCapiBridgeApiBase();
    const key = await getApiKeyOverride();
    if (!apiBase || !key?.trim()) {
      Alert.alert(
        'Configuration requise',
        'Renseignez l’URL pont CAPI et la clé API (onglet Réseau) pour consulter les documents synchronisés.',
      );
      return;
    }
    setOpeningId(doc.versionId);
    try {
      const localUri = await downloadCapiAccueilProDocumentToCache(
        spectacleRefId,
        doc.versionId,
        doc.nom || 'document.pdf',
      );
      if (!localUri) {
        Alert.alert(doc.nom, 'Impossible de télécharger ce document depuis CAPI.');
        return;
      }
      const isPdf = (doc.mimeType ?? '').includes('pdf') || doc.nom.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        setPreviewTitle(doc.nom);
        setPreviewUri(localUri);
        return;
      }
      Alert.alert(doc.nom, 'Document téléchargé. Ouvrez-le depuis le partage système si besoin.', [
        { text: t('accueilpro.cancel'), style: 'cancel' },
        {
          text: 'Partager',
          onPress: () => void Sharing.shareAsync(localUri, { mimeType: doc.mimeType ?? undefined }),
        },
      ]);
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📁</Text>}
      headerTitle={eventName}
      headerSubtitle="Documents CAPI (fiche spectacle)"
      showFieldStrip
    >
      {loading && <Text style={apStyles.hint}>Chargement…</Text>}
      {!loading && !docs.length && (
        <Text style={apStyles.hint}>
          Aucun document synchronisé. Lancez la sync catalogues CAPI → CATRACK (onglet Réseau ou Parc QR).
        </Text>
      )}
      {docs.map((doc) => (
        <AccueilProFormCard key={doc.id} style={{ marginBottom: 8, opacity: openingId === doc.versionId ? 0.6 : 1 }}>
          <TouchableOpacity disabled={!!openingId} onPress={() => void openDoc(doc)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '600', flex: 1 }}>{doc.nom}</Text>
              {openingId === doc.versionId ? <ActivityIndicator size="small" /> : null}
            </View>
            {doc.cheminDossier ? <Text style={apStyles.hint}>{doc.cheminDossier}</Text> : null}
            <Text style={apStyles.hint}>
              {[doc.pole, doc.mimeType].filter(Boolean).join(' · ')}
            </Text>
          </TouchableOpacity>
        </AccueilProFormCard>
      ))}
      <AccueilProPdfPreviewModal
        visible={!!previewUri}
        title={previewTitle}
        uri={previewUri}
        onClose={() => {
          setPreviewUri(null);
          setPreviewTitle('');
        }}
      />
    </AccueilProScreenLayout>
  );
}
