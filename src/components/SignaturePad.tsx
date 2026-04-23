import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Colors } from '../theme/colors';

type Props = {
  onOK: (base64Png: string) => void;
  onClear?: () => void;
};

const WEB_SIG_STYLE = `
  .m-signature-pad { box-shadow: none; border: none; margin: 0; }
  .m-signature-pad--body { border: none !important; }
  .m-signature-pad--footer { display: none !important; }
  body, html { margin: 0; padding: 0; background: #ffffff; overflow: hidden; touch-action: none; }
  canvas { touch-action: none !important; -ms-touch-action: none; }
`;

export default function SignaturePad({ onOK, onClear }: Props) {
  const ref = useRef<React.ElementRef<typeof SignatureCanvas>>(null);
  const [hint, setHint] = useState('Signez dans le cadre avec le doigt ou un stylet.');

  const handleOK = (sig: string) => {
    const raw = sig.replace(/^data:image\/png;base64,/, '');
    onOK(raw);
    setHint('Signature enregistrée. Effacer pour recommencer.');
  };

  const handleEmpty = () => {
    setHint('Zone vide — tracez une signature dans le cadre, puis « Valider ».');
  };

  return (
    <View style={s.wrap}>
      <Text style={s.label}>Signature électronique (emprunteur)</Text>
      <Text style={s.hint}>{hint}</Text>
      <View style={s.box} collapsable={false}>
        <SignatureCanvas
          ref={ref}
          onOK={handleOK}
          onEmpty={handleEmpty}
          descriptionText=""
          clearText=""
          confirmText=""
          nestedScrollEnabled
          scrollable={false}
          minWidth={1}
          maxWidth={3.5}
          minDistance={2}
          penColor="#000000"
          backgroundColor="#ffffff"
          webStyle={WEB_SIG_STYLE}
          androidLayerType={Platform.OS === 'android' ? 'software' : 'hardware'}
        />
      </View>
      <View style={s.row}>
        <TouchableOpacity
          style={s.secondary}
          onPress={() => {
            ref.current?.clearSignature();
            onClear?.();
            setHint('Signez dans le cadre avec le doigt ou un stylet.');
          }}
        >
          <Text style={s.secondaryTxt}>Effacer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.primary} onPress={() => ref.current?.readSignature()}>
          <Text style={s.primaryTxt}>Valider la signature</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500', marginBottom: 4 },
  hint: { color: Colors.textMuted, fontSize: 11, marginBottom: 8, lineHeight: 15 },
  box: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#ffffff',
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  primary: {
    flex: 1, backgroundColor: Colors.green, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  primaryTxt: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  secondary: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', backgroundColor: Colors.bgInput,
  },
  secondaryTxt: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
});
