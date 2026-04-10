import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Colors } from '../theme/colors';

type Props = {
  onOK: (base64Png: string) => void;
  onClear?: () => void;
};

export default function SignaturePad({ onOK, onClear }: Props) {
  const ref = useRef<React.ElementRef<typeof SignatureCanvas>>(null);

  const handleOK = (sig: string) => {
    const raw = sig.replace(/^data:image\/png;base64,/, '');
    onOK(raw);
  };

  return (
    <View style={s.wrap}>
      <Text style={s.label}>Signature électronique (emprunteur)</Text>
      <View style={s.box}>
        <SignatureCanvas
          ref={ref}
          onOK={handleOK}
          onEmpty={() => {}}
          descriptionText=""
          clearText=""
          confirmText=""
          webStyle={`.m-signature-pad--footer {display: none;} body,html { background: #1c2130; }`}
          backgroundColor="rgba(28,33,48,0.9)"
          penColor="#ffffff"
        />
      </View>
      <View style={s.row}>
        <TouchableOpacity
          style={s.secondary}
          onPress={() => {
            ref.current?.clearSignature();
            onClear?.();
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
  label: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500', marginBottom: 8 },
  box: { height: 180, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
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
