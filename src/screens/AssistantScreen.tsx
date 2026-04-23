// src/screens/AssistantScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  InteractionManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import { TabScreenSafeArea } from '../components/UI';
import { Colors, Shadow } from '../theme/colors';
import { useAppAuth } from '../context/AuthContext';
import {
  postAssistantAsk,
  type AssistantAskError,
  type AssistantJsonPayload,
} from '../lib/assistantApi';
import { isConsumerApp } from '../config/appMode';

const STORAGE_KEY = 'stagestock_assistant_history_v1';
const MAX_MESSAGES = 80;

/**
 * Messages explicites (mode grand public) au lieu d’un seul libellé générique.
 * L’IA appelle POST /ask sur l’URL du backend ; échec fréquent = Ollama arrêté, mauvaise URL, ou session.
 */
function consumerAssistantFailureMessage(
  status: number,
  body: AssistantAskError | string
): string {
  if (status === 0) {
    const m = typeof body === 'string' ? body : 'Erreur réseau';
    return (
      `Impossible de joindre le serveur Stage Stock.\n\n` +
      `(${m})\n\n` +
      `→ Même Wi‑Fi que le PC ? URL correcte dans l’onglet « Connexion » ? ` +
      `Le PC doit avoir le backend et Ollama démarrés si vous êtes en local.`
    );
  }
  if (typeof body === 'string') {
    return (
      `Le serveur a répondu une erreur (HTTP ${status}).\n\n` +
      `${body.slice(0, 400)}`
    );
  }
  const err = body.error ?? 'Erreur';
  const detail = body.detail ? `\n\n${String(body.detail).slice(0, 500)}` : '';
  const hint = body.hint ? `\n\nIndication : ${body.hint}` : '';
  if (status === 401) {
    return (
      `Connexion refusée (session ou clé API).\n\n` +
      `• Si vous utilisez le serveur sur le PC : vérifiez la clé API dans l’onglet Connexion / Réseau (identique au fichier .env du serveur).\n` +
      `• Compte cloud : déconnectez-vous puis reconnectez-vous, ou déconnexion du compte en ligne uniquement dans Paramètres.`
    );
  }
  if (status === 503 || status === 502) {
    return (
      `L’assistant IA n’a pas pu répondre (moteur Ollama sur le serveur).\n\n` +
      `${err}${detail}${hint}`
    );
  }
  return `Connexion au service impossible.\n\n${err}${detail}`.slice(0, 1500);
}

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  createdAt: number;
  text?: string;
  assistant?: AssistantJsonPayload;
  error?: string;
  provider?: string;
  model?: string;
};

function loadMessages(raw: string | null): ChatMessage[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(
      (m): m is ChatMessage =>
        m &&
        typeof m === 'object' &&
        (m as ChatMessage).id &&
        ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant')
    );
  } catch {
    return [];
  }
}

export default function AssistantScreen() {
  const { user } = useAppAuth();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setMessages(loadMessages(raw));
      setHydrated(true);
    })();
  }, []);

  const prefill = route.params?.prefill as string | undefined;
  useEffect(() => {
    if (!prefill?.trim()) return;
    setInput(prefill);
    navigation.setParams({ prefill: undefined } as any);
  }, [prefill, navigation]);

  const persist = useCallback(async (next: ChatMessage[]) => {
    const trimmed = next.slice(-MAX_MESSAGES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }, []);

  const appendMessage = useCallback(
    (m: ChatMessage) => {
      setMessages(prev => {
        const next = [...prev, m];
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  const onSend = useCallback(async () => {
    const t = input.trim();
    if (!t || sending) return;
    setInput('');
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      createdAt: Date.now(),
      text: t,
    };
    appendMessage(userMsg);
    setSending(true);
    await new Promise<void>(resolve => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    try {
      const recent = [...messages, userMsg]
        .slice(-4)
        .map(m => {
          const line =
            m.role === 'user'
              ? `Utilisateur: ${m.text ?? ''}`
              : `Assistant: ${m.assistant?.summary ?? m.error ?? ''}`;
          return line.length > 450 ? `${line.slice(0, 450)}…` : line;
        })
        .join('\n');
      const res = await postAssistantAsk(t, {
        userId: user?.id,
        context: recent.length > t.length ? recent : undefined,
      });
      if (!res.ok) {
        const errText =
          typeof res.body === 'string'
            ? res.body
            : (res.body as { error?: string; message?: string })?.error ??
              (res.body as { message?: string })?.message ??
              JSON.stringify(res.body);
        appendMessage({
          id: `a-${Date.now()}`,
          role: 'assistant',
          createdAt: Date.now(),
          error: isConsumerApp()
            ? consumerAssistantFailureMessage(res.status, res.body as AssistantAskError | string)
            : res.status === 0
              ? `Réseau : ${errText}`
              : `HTTP ${res.status} — ${errText}`,
        });
        return;
      }
      appendMessage({
        id: `a-${Date.now()}`,
        role: 'assistant',
        createdAt: Date.now(),
        assistant: res.data.response,
        provider: res.data.provider,
        model: res.data.model,
      });
    } catch (e) {
      appendMessage({
        id: `a-${Date.now()}`,
        role: 'assistant',
        createdAt: Date.now(),
        error: isConsumerApp()
          ? consumerAssistantFailureMessage(0, e instanceof Error ? e.message : String(e))
          : e instanceof Error
            ? e.message
            : String(e),
      });
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, user?.id, appendMessage]);

  const clearHistory = useCallback(() => {
    Alert.alert('Effacer l’historique', 'Supprimer tous les messages de cet appareil ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Effacer',
        style: 'destructive',
        onPress: async () => {
          setMessages([]);
          await AsyncStorage.removeItem(STORAGE_KEY);
        },
      },
    ]);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length, sending]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={[styles.bubbleRow, styles.bubbleRowUser]}>
          <View style={[styles.bubble, styles.bubbleUser]}>
            <Text style={styles.bubbleUserText}>{item.text}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
        <View style={[styles.bubble, styles.bubbleBot]}>
          {item.error ? (
            <Text style={styles.errText}>{item.error}</Text>
          ) : item.assistant ? (
            <AssistantJsonCard
              data={item.assistant}
              meta={{ provider: item.provider, model: item.model }}
              consumer={isConsumerApp()}
            />
          ) : (
            <Text style={styles.muted}>Réponse vide</Text>
          )}
        </View>
      </View>
    );
  }, []);

  return (
    <TabScreenSafeArea style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.headerPad}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <Text style={{ fontSize: 22 }}>✨</Text>
              <Text style={styles.screenTitle}>Assistant IA</Text>
            </View>
            <TouchableOpacity onPress={clearHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearLink}>Effacer</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            {isConsumerApp()
              ? 'Parlez comme en message : pas besoin de commandes précises. Questions vagues ou courtes acceptées.'
              : 'Réponses JSON (Ollama / backend). Configurez l’URL et la clé dans Réseau.'}
          </Text>
        </View>

        {!hydrated ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.green} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={12}
            windowSize={12}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {isConsumerApp()
                  ? 'Posez une question sur votre stock ou vos prêts.'
                  : 'Posez une question sur le stock, le diagnostic serveur ou l’installation.'}
              </Text>
            }
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={isConsumerApp() ? 'Écrivez comme vous voulez…' : 'Votre message…'}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={4000}
            editable={!sending}
            onSubmitEditing={() => void onSend()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff]}
            onPress={() => void onSend()}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.sendBtnText}>Envoyer</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TabScreenSafeArea>
  );
}

function AssistantJsonCard({
  data,
  meta,
  consumer,
}: {
  data: AssistantJsonPayload;
  meta?: { provider?: string; model?: string };
  consumer?: boolean;
}) {
  const chatLike = Boolean(consumer && data.intent === 'general');
  return (
    <View>
      {!consumer && meta?.provider ? (
        <Text style={styles.meta}>
          {meta.provider}
          {meta.model ? ` · ${meta.model}` : ''}
        </Text>
      ) : null}
      {!chatLike ? (
        <Text style={styles.cardTitle}>{data.title || 'Réponse'}</Text>
      ) : data.title?.trim() ? (
        <Text style={styles.cardTitleChat}>{data.title.trim()}</Text>
      ) : null}
      {!consumer ? (
        <View style={styles.intentPill}>
          <Text style={styles.intentText}>{data.intent}</Text>
        </View>
      ) : null}
      <Text style={[styles.summary, chatLike && styles.summaryChat]}>{data.summary}</Text>
      {data.details?.length ? (
        <View style={styles.block}>
          <Text style={styles.blockLbl}>Détails</Text>
          {data.details.map((line, i) => (
            <Text key={i} style={styles.bullet}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}
      {!consumer && data.diagnostic_hints?.length ? (
        <View style={styles.block}>
          <Text style={styles.blockLbl}>Diagnostic</Text>
          {data.diagnostic_hints.map((line, i) => (
            <Text key={i} style={styles.bullet}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}
      {!consumer && data.install_steps?.length ? (
        <View style={styles.block}>
          <Text style={styles.blockLbl}>Installation</Text>
          {data.install_steps.map((line, i) => (
            <Text key={i} style={styles.bullet}>
              {i + 1}. {line}
            </Text>
          ))}
        </View>
      ) : null}
      {!consumer && data.execute_action ? (
        <View style={styles.actionBox}>
          <Text style={styles.blockLbl}>Action suggérée</Text>
          <Text style={styles.mono}>{data.execute_action.action}</Text>
          {data.execute_action.payload && Object.keys(data.execute_action.payload).length > 0 ? (
            <Text style={styles.monoSmall}>{JSON.stringify(data.execute_action.payload, null, 0)}</Text>
          ) : null}
        </View>
      ) : null}
      {data.caveats?.length ? (
        <View style={styles.caveat}>
          {data.caveats.map((c, i) => (
            <Text key={i} style={styles.caveatText}>
              ⚠ {c}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  headerPad: { paddingHorizontal: 20, paddingBottom: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  screenTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  clearLink: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  hint: { color: Colors.textMuted, fontSize: 12, marginBottom: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowBot: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '92%',
    borderRadius: 16,
    padding: 12,
    ...Shadow.card,
  },
  bubbleUser: {
    backgroundColor: Colors.greenMuted,
    borderWidth: 1,
    borderColor: Colors.green,
  },
  bubbleBot: {
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  bubbleUserText: { color: Colors.white, fontSize: 15, lineHeight: 22 },
  errText: { color: Colors.red, fontSize: 14 },
  muted: { color: Colors.textMuted },
  meta: { color: Colors.textMuted, fontSize: 11, marginBottom: 6 },
  cardTitle: { color: Colors.white, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  cardTitleChat: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  intentPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  intentText: { color: Colors.green, fontSize: 12, fontWeight: '600' },
  summary: { color: Colors.textPrimary, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  summaryChat: { fontSize: 15, lineHeight: 23 },
  block: { marginBottom: 10 },
  blockLbl: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  bullet: { color: Colors.textPrimary, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  actionBox: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mono: { color: Colors.green, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  monoSmall: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  caveat: { marginTop: 8 },
  caveatText: { color: Colors.yellow, fontSize: 12, marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.bgElevated,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: Colors.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.bgInputBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.white,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: Colors.green,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  sendBtnOff: { opacity: 0.45 },
  sendBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
