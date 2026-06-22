import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import SignaturePad from '../../components/SignaturePad';
import { AccueilProPdfPreviewModal } from '../../components/accueilpro/AccueilProPdfPreviewModal';
import {
  AccueilProChip,
  AccueilProFormCard,
  AccueilProFormSelectPicker,
  AccueilProInput,
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { useAppAuth } from '../../context/AuthContext';
import { useConnection } from '../../context/ConnectionContext';
import {
  deleteApConvention,
  generateApId,
  getApConvention,
  getApEvent,
  getApVenue,
  listApEvents,
  saveApConvention,
} from '../../db/accueilProDb';
import { uploadAccueilProConventionPdf } from '../../lib/accueilProConventionDocumentUpload';
import { persistConventionPdfCopy, removeConventionPdfLocal } from '../../lib/accueilProConventionPdfStorage';
import { logAccueilProAction } from '../../lib/accueilProActivityLog';
import { resolveAccueilProSyncEndpoint } from '../../lib/accueilProApiSync';
import { exportAccueilProConventionPdf } from '../../lib/pdfAccueilProConvention';
import type { ApConventionStatus } from '../../types/accueilPro';

function pickPdfUri(pick: DocumentPicker.DocumentPickerResult): { uri: string; name: string } | null {
  if (pick.canceled) return null;
  const asset = pick.assets?.[0];
  if (!asset?.uri) return null;
  const name = asset.name?.trim() || 'convention.pdf';
  return { uri: asset.uri, name };
}

function eventOptionLabel(name: string, date?: string | null): string {
  const d = date?.slice(0, 10);
  return d ? `${name} · ${d}` : name;
}

export default function AccueilProConventionEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const { user } = useAppAuth();
  const { status: connStatus } = useConnection();
  const presetEventId = route.params?.eventId as string | undefined;
  const venueId = route.params?.venueId as string | undefined;
  const conventionId = route.params?.id as string | undefined;
  const signNow = route.params?.signNow as boolean | undefined;
  const requireEvent = route.params?.requireEvent === true || (!presetEventId && !venueId && !conventionId);
  const [selectedEventId, setSelectedEventId] = useState(presetEventId ?? '');
  const [resolvedVenueId, setResolvedVenueId] = useState<string | undefined>(venueId);
  const [loading, setLoading] = useState(!!conventionId);
  const [saving, setSaving] = useState(false);
  const [eventOptions, setEventOptions] = useState<{ label: string; value: string }[]>([]);
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [status, setStatus] = useState<ApConventionStatus>('brouillon');
  const [signatureB64, setSignatureB64] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signedBy, setSignedBy] = useState<string | null>(null);
  const [documentLocalUri, setDocumentLocalUri] = useState<string | null>(null);
  const [documentFilename, setDocumentFilename] = useState<string | null>(null);
  const [documentStoragePath, setDocumentStoragePath] = useState<string | null>(null);
  const [pdfPreviewed, setPdfPreviewed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showSignPad, setShowSignPad] = useState(!!signNow);

  useEffect(() => {
    void (async () => {
      const all = await listApEvents();
      const filtered =
        resolvedVenueId ? all.filter(e => e.venue_id === resolvedVenueId) : all;
      const sorted = [...filtered].sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? ''));
      setEventOptions(
        sorted.map(e => ({
          label: eventOptionLabel(e.name, e.date_debut),
          value: e.id,
        }))
      );
    })();
  }, [resolvedVenueId]);

  useEffect(() => {
    setResolvedVenueId(venueId);
  }, [venueId]);

  useEffect(() => {
    if (presetEventId) setSelectedEventId(presetEventId);
  }, [presetEventId]);

  useEffect(() => {
    if (conventionId || selectedEventId) return;
    if (!resolvedVenueId) return;
    void getApVenue(resolvedVenueId).then(v => {
      if (v) {
        setTitre(prev =>
          prev.trim() ? prev : `${t('accueilpro.venues.conventionDefaultTitle')} — ${v.name}`
        );
      }
    });
  }, [conventionId, selectedEventId, resolvedVenueId, t]);

  useEffect(() => {
    if (!conventionId) return;
    void getApConvention(conventionId).then(c => {
      if (c) {
        setTitre(c.titre);
        setContenu(c.contenu ?? '');
        setStatus(c.status);
        setSignatureB64(c.signature_data ?? null);
        setSignedAt(c.signed_at ?? null);
        setSignedBy(c.signed_by ?? null);
        setDocumentLocalUri(c.document_local_uri ?? null);
        setDocumentFilename(c.document_filename ?? null);
        setDocumentStoragePath(c.document_storage_path ?? null);
        setPdfPreviewed(!!c.document_local_uri);
        if (c.event_id) setSelectedEventId(c.event_id);
        if (c.venue_id) setResolvedVenueId(c.venue_id);
      }
      setLoading(false);
    });
  }, [conventionId]);

  const onEventChange = useCallback(
    async (id: string) => {
      setSelectedEventId(id);
      if (!id) return;
      const ev = await getApEvent(id);
      if (!ev) return;
      if (ev.venue_id) setResolvedVenueId(ev.venue_id);
      if (!titre.trim()) {
        setTitre(`${t('accueilpro.conventions.defaultTitlePrefix')} — ${ev.name}`);
      }
    },
    [titre, t]
  );

  const selectedEventName = useMemo(() => {
    const opt = eventOptions.find(o => o.value === selectedEventId);
    return opt?.label ?? '';
  }, [eventOptions, selectedEventId]);

  const openPreview = useCallback(() => {
    if (!documentLocalUri) {
      Alert.alert(t('accueilpro.conventions.pdfTitle'), t('accueilpro.conventions.pdfPickFirst'));
      return;
    }
    setPreviewOpen(true);
    setPdfPreviewed(true);
  }, [documentLocalUri, t]);

  const onPickPdf = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      const parsed = pickPdfUri(pick);
      if (!parsed) return;
      const id = conventionId ?? generateApId();
      const local = await persistConventionPdfCopy(id, parsed.uri, parsed.name);
      if (documentLocalUri && documentLocalUri !== local) {
        await removeConventionPdfLocal(documentLocalUri);
      }
      setDocumentLocalUri(local);
      setDocumentFilename(parsed.name);
      setDocumentStoragePath(null);
      setPdfPreviewed(false);
      setShowSignPad(false);
    } catch (e) {
      Alert.alert(t('accueilpro.conventions.errorTitle'), e instanceof Error ? e.message : String(e));
    }
  };

  const onRemovePdf = async () => {
    await removeConventionPdfLocal(documentLocalUri);
    setDocumentLocalUri(null);
    setDocumentFilename(null);
    setDocumentStoragePath(null);
    setPdfPreviewed(false);
    setShowSignPad(false);
  };

  const tryOpenSignPad = () => {
    if (documentLocalUri && !pdfPreviewed) {
      Alert.alert(t('accueilpro.conventions.pdfPreviewRequiredTitle'), t('accueilpro.conventions.pdfPreviewRequiredBody'), [
        { text: t('accueilpro.cancel'), style: 'cancel' },
        { text: t('accueilpro.conventions.viewPdf'), onPress: openPreview },
      ]);
      return;
    }
    setShowSignPad(true);
  };

  const uploadPdfIfNeeded = async (id: string, localUri: string, filename: string) => {
    if (connStatus !== 'ok') return documentStoragePath;
    const endpoint = await resolveAccueilProSyncEndpoint();
    if (!endpoint) return documentStoragePath;
    try {
      const up = await uploadAccueilProConventionPdf({
        conventionId: id,
        fileUri: localUri,
        filename,
        endpoint,
      });
      return up.storagePath;
    } catch {
      return documentStoragePath;
    }
  };

  const persist = useCallback(
    async (opts?: { sign?: boolean; exportPdf?: boolean }) => {
      if (!titre.trim()) {
        Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.conventions.errTitle'));
        return null;
      }
      if (!selectedEventId.trim()) {
        Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.conventions.errEvent'));
        return null;
      }
      if (opts?.sign && !signatureB64) {
        Alert.alert(t('accueilpro.conventions.signTitle'), t('accueilpro.conventions.signNeed'));
        return null;
      }
      if (opts?.sign && documentLocalUri && !pdfPreviewed) {
        Alert.alert(t('accueilpro.conventions.pdfPreviewRequiredTitle'), t('accueilpro.conventions.pdfPreviewRequiredBody'));
        return null;
      }
      setSaving(true);
      try {
        const id = conventionId ?? generateApId();
        const now = new Date().toISOString();
        const actor = user?.nom?.trim() || null;
        let storagePath = documentStoragePath;
        if (documentLocalUri && documentFilename) {
          storagePath = await uploadPdfIfNeeded(id, documentLocalUri, documentFilename);
          if (storagePath && storagePath !== documentStoragePath) {
            setDocumentStoragePath(storagePath);
          }
        }
        const ev = await getApEvent(selectedEventId);
        const row = {
          id,
          event_id: selectedEventId,
          venue_id: ev?.venue_id ?? resolvedVenueId ?? null,
          titre: titre.trim(),
          contenu: contenu.trim() || null,
          status: (opts?.sign ? 'signé' : status) as ApConventionStatus,
          signature_data: signatureB64,
          signed_at: opts?.sign ? now : signedAt,
          signed_by: opts?.sign ? actor : signedBy,
          document_local_uri: documentLocalUri,
          document_storage_path: storagePath,
          document_filename: documentFilename,
        };
        await saveApConvention(row);
        if (opts?.sign) {
          setStatus('signé');
          setSignedAt(now);
          setSignedBy(actor);
          await logAccueilProAction({
            action: 'convention.signed',
            entity: 'convention',
            entityId: id,
            summary: `Convention signée : ${row.titre}`,
            actorName: actor,
          });
          if (opts.exportPdf !== false) {
            await exportAccueilProConventionPdf(row, ev?.name);
          }
        }
        return id;
      } finally {
        setSaving(false);
      }
    },
    [
      titre,
      contenu,
      status,
      signatureB64,
      signedAt,
      signedBy,
      conventionId,
      selectedEventId,
      resolvedVenueId,
      user?.nom,
      t,
      documentLocalUri,
      documentFilename,
      documentStoragePath,
      pdfPreviewed,
      connStatus,
    ]
  );

  const onSave = useCallback(async () => {
    const id = await persist();
    if (id) navigation.goBack();
  }, [persist, navigation]);

  const onSignAndExport = useCallback(async () => {
    const id = await persist({ sign: true, exportPdf: true });
    if (id) navigation.goBack();
  }, [persist, navigation]);

  const onDelete = useCallback(() => {
    if (!conventionId) return;
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.conventions.deleteBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            await removeConventionPdfLocal(documentLocalUri);
            await deleteApConvention(conventionId);
            navigation.goBack();
          })(),
      },
    ]);
  }, [conventionId, documentLocalUri, navigation, t]);

  const statuses: ApConventionStatus[] = ['brouillon', 'signé'];

  const pickerOptions = useMemo(() => {
    if (!requireEvent && eventOptions.length === 0) {
      return [{ label: t('accueilpro.conventions.noEventsAvailable'), value: '' }];
    }
    return eventOptions;
  }, [eventOptions, requireEvent, t]);

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📄</Text>}
      headerTitle={conventionId ? t('accueilpro.conventions.edit') : t('accueilpro.conventions.new')}
      loading={loading}
      footer={
        <AccueilProPrimaryButton label={t('accueilpro.save')} onPress={() => void onSave()} loading={saving} />
      }
    >
      <AccueilProFormCard>
        <Text style={apStyles.sectionTitle}>{t('accueilpro.conventions.linkedEvent')}</Text>
        <AccueilProFormSelectPicker
          label={t('accueilpro.events.fieldName')}
          value={selectedEventId}
          onChange={v => void onEventChange(v)}
          options={pickerOptions}
        />
        {selectedEventId && selectedEventName ?
          <Text style={apStyles.hint}>{selectedEventName}</Text>
        : requireEvent ?
          <Text style={[apStyles.hint, { color: AccueilProColors.gold, fontWeight: '600' }]}>
            {t('accueilpro.conventions.eventRequiredHint')}
          </Text>
        : null}

        <AccueilProInput label={t('accueilpro.conventions.fieldTitle')} value={titre} onChangeText={setTitre} required />
        <AccueilProInput label={t('accueilpro.conventions.fieldBody')} value={contenu} onChangeText={setContenu} multiline />

        <Text style={apStyles.label}>{t('accueilpro.conventions.pdfTitle')}</Text>
        <Text style={apStyles.hint}>{t('accueilpro.conventions.pdfHint')}</Text>
        {documentFilename ?
          <View style={{ marginBottom: 12, gap: 8 }}>
            <Text style={{ fontWeight: '700', color: AccueilProColors.navy }}>{documentFilename}</Text>
            {!pdfPreviewed ?
              <Text style={{ color: AccueilProColors.gold, fontSize: 13, fontWeight: '700' }}>
                {t('accueilpro.conventions.pdfPreviewPending')}
              </Text>
            : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <AccueilProLinkButton label={t('accueilpro.conventions.viewPdf')} onPress={openPreview} />
              <AccueilProLinkButton label={t('accueilpro.conventions.replacePdf')} onPress={() => void onPickPdf()} />
              <AccueilProLinkButton label={t('accueilpro.conventions.removePdf')} onPress={() => void onRemovePdf()} />
            </View>
          </View>
        : <AccueilProPrimaryButton label={t('accueilpro.conventions.pickPdf')} onPress={() => void onPickPdf()} />}
      </AccueilProFormCard>

      <AccueilProFormCard>
        <Text style={apStyles.label}>{t('accueilpro.orgs.status')}</Text>
        {statuses.map(st => (
          <AccueilProChip key={st} label={st} selected={status === st} onPress={() => setStatus(st)} />
        ))}
        {signedAt ?
          <Text style={[apStyles.hint, { marginTop: 8 }]}>
            {t('accueilpro.conventions.signedMeta', { who: signedBy ?? '—', when: signedAt.slice(0, 16) })}
          </Text>
        : null}
        {!showSignPad ?
          <AccueilProLinkButton label={t('accueilpro.conventions.openSign')} onPress={tryOpenSignPad} />
        : (
          <>
            <SignaturePad
              label={t('accueilpro.conventions.signLabel')}
              onOK={b64 => setSignatureB64(b64)}
              onClear={() => setSignatureB64(null)}
            />
            <AccueilProPrimaryButton
              label={t('accueilpro.conventions.signExport')}
              onPress={() => void onSignAndExport()}
              loading={saving}
            />
          </>
        )}
        {signatureB64 && status === 'signé' ?
          <AccueilProLinkButton
            label={t('accueilpro.conventions.exportPdf')}
            onPress={() =>
              void exportAccueilProConventionPdf(
                {
                  id: conventionId ?? '',
                  event_id: selectedEventId,
                  titre: titre.trim(),
                  contenu,
                  status,
                  signature_data: signatureB64,
                  signed_at: signedAt,
                  signed_by: signedBy,
                  document_local_uri: documentLocalUri,
                  document_storage_path: documentStoragePath,
                  document_filename: documentFilename,
                },
                undefined
              )
            }
          />
        : null}
      </AccueilProFormCard>

      {conventionId ?
        <AccueilProLinkButton label={t('accueilpro.delete')} onPress={onDelete} />
      : null}

      <AccueilProPdfPreviewModal
        visible={previewOpen}
        title={documentFilename ?? t('accueilpro.conventions.pdfTitle')}
        uri={documentLocalUri}
        onClose={() => setPreviewOpen(false)}
      />
    </AccueilProScreenLayout>
  );
}
