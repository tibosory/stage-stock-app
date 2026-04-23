// src/hooks/useNfc.ts
import { useState, useEffect, useCallback } from 'react';
import { AppState, Alert } from 'react-native';

// Import conditionnel NFC (ne fonctionne pas sur Expo Go standard)
let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;

try {
  const nfcModule = require('react-native-nfc-manager');
  NfcManager = nfcModule.default;
  NfcTech = nfcModule.NfcTech;
  Ndef = nfcModule.Ndef;
} catch {
  // Expo Go or unsupported runtime: keep NFC disabled silently.
}

export const useNfc = () => {
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcEnabled, setNfcEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);

  const normalizeTagId = (id: unknown): string | null => {
    if (!id) return null;
    if (Array.isArray(id)) {
      return id
        .map((b: number) => Number(b).toString(16).padStart(2, '0'))
        .join(':')
        .toLowerCase();
    }
    if (typeof id === 'string') return id.toLowerCase();
    return null;
  };

  const decodeTagPayload = (tag: any): string | null => {
    if (!tag?.ndefMessage?.length || !Ndef) return null;
    for (const record of tag.ndefMessage) {
      try {
        if (record?.tnf === Ndef.TNF_WELL_KNOWN && record?.type?.[0] === 0x54) {
          const txt = Ndef.text.decodePayload(record.payload);
          if (txt?.trim()) return txt.trim();
        }
      } catch {}
      try {
        if (record?.tnf === Ndef.TNF_WELL_KNOWN && record?.type?.[0] === 0x55) {
          const uri = Ndef.uri.decodePayload(record.payload);
          if (uri?.trim()) return uri.trim();
        }
      } catch {}
    }
    return null;
  };

  const refreshNfcState = useCallback(async () => {
    if (!NfcManager || typeof NfcManager.isEnabled !== 'function') return;
    try {
      const enabled = await NfcManager.isEnabled();
      setNfcEnabled(enabled);
    } catch {
      setNfcEnabled(false);
    }
  }, []);

  useEffect(() => {
    const hasRuntimeNfc =
      !!NfcManager &&
      typeof NfcManager.isSupported === 'function' &&
      typeof NfcManager.start === 'function' &&
      typeof NfcManager.isEnabled === 'function';
    if (!hasRuntimeNfc) return;
    const init = async () => {
      try {
        const supported = await NfcManager.isSupported();
        setNfcSupported(supported);
        if (supported) {
          await NfcManager.start();
          await refreshNfcState();
        }
      } catch {
        // Keep NFC disabled without noisy logs in unsupported environments.
      }
    };
    init();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshNfcState();
      }
    });
    return () => {
      sub.remove();
      if (NfcManager) NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, [refreshNfcState]);

  // Lit un tag NFC et retourne son identifiant ou son contenu texte
  const readNfcTag = useCallback(async (): Promise<string | null> => {
    if (!NfcManager || !nfcSupported) {
      Alert.alert('NFC non disponible', 'Ce téléphone ne supporte pas le NFC ou le module n\'est pas installé.');
      return null;
    }
    if (!nfcEnabled) {
      Alert.alert('NFC désactivé', 'Activez le NFC dans les paramètres de votre téléphone.');
      return null;
    }

    try {
      setScanning(true);
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();

      let tagValue = decodeTagPayload(tag);
      if (!tagValue) tagValue = normalizeTagId(tag?.id);
      return tagValue;
    } catch (e) {
      return null;
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      setScanning(false);
    }
  }, [nfcSupported, nfcEnabled]);

  // Écrit un texte sur un tag NFC vierge
  const writeNfcTag = useCallback(async (text: string): Promise<boolean> => {
    if (!NfcManager || !nfcSupported) return false;
    await refreshNfcState();
    if (!nfcEnabled) return false;

    try {
      setScanning(true);
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const bytes = Ndef.encodeMessage([Ndef.textRecord(text)]);
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
      return true;
    } catch {
      return false;
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      setScanning(false);
    }
  }, [nfcSupported, nfcEnabled, refreshNfcState]);

  // Récupère juste l'ID hardware du tag (sans lecture NDEF)
  const readNfcTagId = useCallback(async (): Promise<string | null> => {
    if (!NfcManager || !nfcSupported) return null;
    await refreshNfcState();
    if (!nfcEnabled) return null;

    try {
      setScanning(true);
      await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA, NfcTech.NfcB, NfcTech.NfcF, NfcTech.NfcV]);
      const tag = await NfcManager.getTag();
      return normalizeTagId(tag?.id);
    } catch {
      return null;
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      setScanning(false);
    }
  }, [nfcSupported, nfcEnabled, refreshNfcState]);

  return { nfcSupported, nfcEnabled, scanning, readNfcTag, readNfcTagId, writeNfcTag };
};
