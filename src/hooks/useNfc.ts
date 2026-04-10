// src/hooks/useNfc.ts
import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';

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
          const enabled = await NfcManager.isEnabled();
          setNfcEnabled(enabled);
        }
      } catch {
        // Keep NFC disabled without noisy logs in unsupported environments.
      }
    };
    init();
    return () => {
      if (NfcManager) NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

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

      // Essai de lecture du payload texte
      let tagValue: string | null = null;
      if (tag?.ndefMessage && tag.ndefMessage.length > 0) {
        const record = tag.ndefMessage[0];
        try {
          tagValue = Ndef.text.decodePayload(record.payload);
        } catch {
          tagValue = null;
        }
      }

      // Fallback sur l'ID matériel du tag
      if (!tagValue && tag?.id) {
        tagValue = tag.id.map((b: number) => b.toString(16).padStart(2, '0')).join(':');
      }

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
    if (!NfcManager || !nfcSupported || !nfcEnabled) return false;

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
  }, [nfcSupported, nfcEnabled]);

  // Récupère juste l'ID hardware du tag (sans lecture NDEF)
  const readNfcTagId = useCallback(async (): Promise<string | null> => {
    if (!NfcManager || !nfcSupported || !nfcEnabled) return null;

    try {
      setScanning(true);
      await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA, NfcTech.NfcB, NfcTech.NfcF, NfcTech.NfcV]);
      const tag = await NfcManager.getTag();
      if (tag?.id) {
        return tag.id.map((b: number) => b.toString(16).padStart(2, '0')).join(':');
      }
      return null;
    } catch {
      return null;
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      setScanning(false);
    }
  }, [nfcSupported, nfcEnabled]);

  return { nfcSupported, nfcEnabled, scanning, readNfcTag, readNfcTagId, writeNfcTag };
};
