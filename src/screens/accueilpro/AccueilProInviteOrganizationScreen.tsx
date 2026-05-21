import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import {
  AccueilProFormCard,
  AccueilProFormSelectPicker,
  AccueilProInput,
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  apStyles,
  AccueilProColors,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { useSupabaseAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  ACCUEILPRO_CLIENT_ROLE,
  ACCUEILPRO_ORGANISATEUR_ROLE,
} from '../../modules/accueilpro/types/roles';
import { PermissionGuard } from '../../modules/accueilpro/components/PermissionGuard';
import type { TranslateVars } from '../../i18n/strings';
import {
  createAccueilProClientInvitation,
  ensureSupabasePortailOrganizationFromLocal,
  isSupabaseStaffUser,
  listSupabasePortailOrganizations,
  sendAccueilProInvitationEmail,
  type CreateInvitationResult,
  type SupabasePortailOrganization,
} from '../../lib/accueilProInvitationStaff';

type RouteParams = {
  localOrganizationId?: string;
  prefillEmail?: string;
};

export default function AccueilProInviteOrganizationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const { user: sbUser } = useSupabaseAuth();
  const params = (route.params ?? {}) as RouteParams;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orgs, setOrgs] = useState<SupabasePortailOrganization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [email, setEmail] = useState(params.prefillEmail?.trim() ?? '');
  const [invitedRole, setInvitedRole] = useState<string>(ACCUEILPRO_CLIENT_ROLE);
  const [created, setCreated] = useState<CreateInvitationResult | null>(null);

  const supabaseReady = isSupabaseConfigured();
  const staffCloud = isSupabaseStaffUser(sbUser);

  const roleOptions = useMemo(
    () => [
      { value: ACCUEILPRO_CLIENT_ROLE, label: t('accueilpro.invite.roleClient') },
      { value: ACCUEILPRO_ORGANISATEUR_ROLE, label: t('accueilpro.invite.roleOrganisateur') },
    ],
    [t]
  );

  const orgOptions = useMemo(
    () => orgs.map(o => ({ value: o.id, label: o.email ? `${o.name} (${o.email})` : o.name })),
    [orgs]
  );

  const load = useCallback(async () => {
    if (!supabaseReady || !staffCloud) {
      setLoading(false);
      return;
    }
    const list = await listSupabasePortailOrganizations();
    setOrgs(list);

    if (params.localOrganizationId) {
      const ensured = await ensureSupabasePortailOrganizationFromLocal(params.localOrganizationId);
      if (ensured.ok) {
        setOrganizationId(ensured.id);
        if (!list.some(o => o.id === ensured.id)) {
          setOrgs(prev => [...prev, { id: ensured.id, name: ensured.name, email: email || null }].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
    } else if (list.length === 1) {
      setOrganizationId(list[0].id);
      if (!email && list[0].email) setEmail(list[0].email);
    }
    setLoading(false);
  }, [supabaseReady, staffCloud, params.localOrganizationId, email]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!organizationId) {
      Alert.alert(t('accueilpro.invite.errTitle'), t('accueilpro.invite.errOrg'));
      return;
    }
    if (!email.trim()) {
      Alert.alert(t('accueilpro.invite.errTitle'), t('accueilpro.invite.errEmail'));
      return;
    }
    setBusy(true);
    try {
      const result = await createAccueilProClientInvitation({
        email: email.trim(),
        organizationId,
        invitedRole:
          invitedRole === ACCUEILPRO_ORGANISATEUR_ROLE ? ACCUEILPRO_ORGANISATEUR_ROLE : ACCUEILPRO_CLIENT_ROLE,
      });
      setCreated(result);
      if (!result.ok) {
        Alert.alert(t('accueilpro.invite.errTitle'), inviteErrorMessage(result.error, result.message, t));
      }
    } catch (e) {
      Alert.alert(t('accueilpro.invite.errTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onCopyToken = async () => {
    if (!created || !created.ok) return;
    await Clipboard.setStringAsync(created.token);
    Alert.alert(t('accueilpro.invite.copiedTitle'), t('accueilpro.invite.copiedBody'));
  };

  const onSendEmail = async () => {
    if (!created || !created.ok) return;
    const roleLabel =
      created.invitedRole === ACCUEILPRO_ORGANISATEUR_ROLE
        ? t('accueilpro.invite.roleOrganisateur')
        : t('accueilpro.invite.roleClient');
    const subject = t('accueilpro.invite.mailSubject', { org: created.organizationName });
    const body = t('accueilpro.invite.mailBody', {
      org: created.organizationName,
      role: roleLabel,
      token: created.token,
      email: created.email,
    });
    const ok = await sendAccueilProInvitationEmail({ toEmail: created.email, subject, body });
    if (!ok) {
      Alert.alert(t('accueilpro.invite.errTitle'), t('accueilpro.invite.mailFail'));
    }
  };

  const blockedMessage = !supabaseReady
    ? t('accueilpro.invite.needSupabase')
    : !sbUser
      ? t('accueilpro.invite.needSignIn')
      : !staffCloud
        ? t('accueilpro.invite.needStaffRole')
        : null;

  return (
    <PermissionGuard staffOnly fallback={null}>
      <AccueilProScreenLayout
        backLabel={t('accueilpro.back')}
        onBack={() => navigation.goBack()}
        headerIcon={<Text style={{ fontSize: 22 }}>✉️</Text>}
        headerTitle={t('accueilpro.invite.title')}
        headerSubtitle={t('accueilpro.invite.subtitle')}
        loading={loading}
        footer={
          blockedMessage ? undefined : (
            <AccueilProPrimaryButton
              label={t('accueilpro.invite.create')}
              onPress={() => void onCreate()}
              loading={busy || (!!created && created.ok)}
            />
          )
        }
      >
        {blockedMessage ? (
          <AccueilProFormCard>
            <Text style={apStyles.hint}>{blockedMessage}</Text>
            {!sbUser ? (
              <AccueilProLinkButton
                label={t('accueilpro.invite.goLogin')}
                onPress={() => navigation.getParent()?.navigate('Login')}
              />
            ) : null}
          </AccueilProFormCard>
        ) : (
          <>
            <AccueilProFormCard>
              <Text style={apStyles.hint}>{t('accueilpro.invite.hint')}</Text>
              <AccueilProFormSelectPicker
                label={t('accueilpro.invite.fieldOrg')}
                value={organizationId}
                onChange={setOrganizationId}
                options={orgOptions}
              />
              <AccueilProInput
                label={t('accueilpro.invite.fieldEmail')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                required
              />
              <AccueilProFormSelectPicker
                label={t('accueilpro.invite.fieldRole')}
                value={invitedRole}
                onChange={setInvitedRole}
                options={roleOptions}
              />
            </AccueilProFormCard>

            {created && created.ok ? (
              <AccueilProFormCard style={{ marginTop: 16 }}>
                <Text style={apStyles.sectionTitle}>{t('accueilpro.invite.createdTitle')}</Text>
                <Text style={apStyles.hint}>
                  {t('accueilpro.invite.createdHint', {
                    org: created.organizationName,
                    email: created.email,
                  })}
                </Text>
                <View
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: AccueilProColors.card,
                    borderWidth: 1,
                    borderColor: AccueilProColors.borderSubtle,
                  }}
                >
                  <Text selectable style={{ fontFamily: 'monospace', fontSize: 12, color: AccueilProColors.navy }}>
                    {created.token}
                  </Text>
                </View>
                <Text style={[apStyles.hint, { marginTop: 8 }]}>
                  {t('accueilpro.invite.expires', {
                    date: formatExpires(created.expiresAt),
                  })}
                </Text>
                <View style={{ gap: 10, marginTop: 14 }}>
                  <AccueilProLinkButton label={t('accueilpro.invite.copy')} onPress={() => void onCopyToken()} />
                  <AccueilProPrimaryButton label={t('accueilpro.invite.sendMail')} onPress={() => void onSendEmail()} />
                </View>
              </AccueilProFormCard>
            ) : null}
          </>
        )}
      </AccueilProScreenLayout>
    </PermissionGuard>
  );
}

function formatExpires(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR');
  } catch {
    return iso;
  }
}

function inviteErrorMessage(
  error: string,
  message: string | undefined,
  t: (key: string, vars?: TranslateVars) => string
): string {
  const key = `accueilpro.invite.err.${error}`;
  const mapped = t(key);
  if (mapped !== key) return mapped;
  return message ?? error;
}
