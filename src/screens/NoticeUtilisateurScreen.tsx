// src/screens/NoticeUtilisateurScreen.tsx
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Radius, Spacing } from '../theme/spacing';
import { ScreenHeader, TabScreenSafeArea } from '../components/UI';
import { LegalLinksNoticeBlock } from '../components/LegalLinks';
import { getUserGuideForLanguage } from '../content/userGuideLocale';
import type { UserGuideSection } from '../content/userGuideManual';
import { exportShareUserGuidePdf } from '../lib/pdfUserGuideManual';
import { useLanguage } from '../context/LanguageContext';

const CONTACT_EMAIL = 'tibosory@gmail.com';

const SectionCard = memo(function SectionCard({
  icon,
  title,
  paragraphs,
  examples,
  exampleLabel,
}: UserGuideSection & { exampleLabel: string }) {
  return (
    <View style={s.block} accessibilityRole="none">
      <View style={s.blockHead}>
        <Text style={s.blockIcon}>{icon}</Text>
        <Text style={s.blockTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {paragraphs.map((p, i) => (
        <Text key={`${title}-p-${i}`} style={s.p}>
          {p}
        </Text>
      ))}
      {(examples ?? []).map((ex, i) => (
        <View
          key={`${title}-ex-${i}`}
          style={s.exampleBox}
          accessibilityLabel={`${exampleLabel}: ${ex}`}
        >
          <Text style={s.exampleLabel}>{exampleLabel}</Text>
          <Text style={s.exampleText}>{ex}</Text>
        </View>
      ))}
    </View>
  );
});

export default function NoticeUtilisateurScreen() {
  const [pdfBusy, setPdfBusy] = useState(false);
  const { language, t } = useLanguage();
  const { meta, sections } = useMemo(() => getUserGuideForLanguage(language), [language]);

  const headerSubtitle = useMemo(
    () =>
      t('notice.heroMetaLine')
        .replace('{{subtitle}}', meta.subtitle)
        .replace('{{version}}', meta.versionLabel),
    [t, meta.subtitle, meta.versionLabel]
  );

  const onExportPdf = useCallback(() => {
    setPdfBusy(true);
    void (async () => {
      try {
        await exportShareUserGuidePdf(language);
      } catch (e) {
        Alert.alert(t('notice.alertPdf'), e instanceof Error ? e.message : String(e));
      } finally {
        setPdfBusy(false);
      }
    })();
  }, [language, t]);

  const mailA11y = useMemo(
    () => t('notice.mailA11y').replace('{{email}}', CONTACT_EMAIL),
    [t]
  );

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
        <ScreenHeader
          icon={<Text style={{ fontSize: 22 }}>📖</Text>}
          title={t('notice.screenTitle')}
          subtitle={headerSubtitle}
        />

        <View style={s.heroCard}>
          <Text style={s.heroKicker}>{t('notice.heroKicker')}</Text>
          <Text style={s.heroTitle}>{meta.title}</Text>
          <Text style={s.heroSub}>{t('notice.heroExplain')}</Text>
          <View style={s.heroPills}>
            <Text style={s.pill}>{t('notice.pill.simple')}</Text>
            <Text style={s.pill}>{t('notice.pill.offline')}</Text>
            <Text style={s.pill}>{t('notice.pill.pdf')}</Text>
          </View>
          <TouchableOpacity
            style={[s.pdfBtn, pdfBusy && s.pdfBtnDisabled]}
            onPress={onExportPdf}
            disabled={pdfBusy}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('notice.pdfA11y')}
          >
            {pdfBusy ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Text style={s.pdfBtnTitle}>{t('notice.pdfTitle')}</Text>
                <Text style={s.pdfBtnSub}>{t('notice.pdfSub')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.creditCard}>
          <Text style={s.creditLabel}>{t('notice.realisation')}</Text>
          <Text style={s.creditName}>Thibaut Sory</Text>
          <Text style={s.creditSub}>{t('notice.creditSub')}</Text>
          <Pressable
            onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            accessibilityRole="link"
            accessibilityLabel={mailA11y}
            style={s.contactRow}
          >
            <Text style={s.contactIcon}>✉️</Text>
            <Text style={s.emailLink}>{CONTACT_EMAIL}</Text>
          </Pressable>
        </View>

        {sections.map(section => (
          <SectionCard key={section.title} {...section} exampleLabel={t('notice.exampleLabel')} />
        ))}

        <LegalLinksNoticeBlock />

        <View style={s.footer}>
          <Text style={s.footerText}>{t('notice.footerHelp')}</Text>
          <Pressable
            onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            style={s.footerEmailWrap}
            accessibilityRole="link"
            accessibilityLabel={mailA11y}
          >
            <Text style={s.footerEmail}>{CONTACT_EMAIL}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.xl, paddingBottom: 44 },
  heroCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.32)',
    ...Shadow.card,
  },
  heroKicker: { ...Typography.caption, color: Colors.green, fontWeight: '700', letterSpacing: 0.4 },
  heroTitle: { ...Typography.sectionTitle, fontSize: 18, marginTop: 6 },
  heroSub: { ...Typography.bodySecondary, marginTop: Spacing.sm },
  heroPills: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.md },
  pill: {
    color: Colors.green,
    backgroundColor: Colors.greenBg,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '700',
  },
  pdfBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.greenDark,
    borderRadius: Radius.card,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    minHeight: Spacing.touchMin + 4,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
  },
  pdfBtnDisabled: { opacity: 0.65 },
  pdfBtnTitle: { color: Colors.white, fontSize: 17, fontWeight: '900' },
  pdfBtnSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 17,
  },
  creditCard: {
    backgroundColor: Colors.greenBg,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.green,
  },
  creditLabel: { ...Typography.caption, marginBottom: Spacing.xs },
  creditName: { ...Typography.screenTitle, fontSize: 20 },
  creditSub: { ...Typography.bodySecondary, marginTop: Spacing.sm },
  contactRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactIcon: { fontSize: 15 },
  emailLink: { color: Colors.blue, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  block: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    padding: Spacing.lg - 1,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    ...Shadow.card,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  blockIcon: { fontSize: 16 },
  blockTitle: { ...Typography.sectionTitle, color: Colors.green, fontSize: 16, flex: 1 },
  p: { ...Typography.bodySecondary, marginBottom: Spacing.sm },
  exampleBox: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    padding: Spacing.md - 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.greenBg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.green,
  },
  exampleLabel: { color: Colors.green, fontWeight: '800', fontSize: 12, marginBottom: 4 },
  exampleText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  footer: { marginTop: 8, paddingVertical: 16, alignItems: 'center' },
  footerText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  footerEmailWrap: { marginTop: 12, paddingVertical: 4 },
  footerEmail: { color: Colors.blue, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});
