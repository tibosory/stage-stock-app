// App.tsx
import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import './src/lib/systemNotificationSetup';
import React, { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Pressable,
  InteractionManager,
  type ViewStyle,
} from 'react-native';
import { useFonts } from 'expo-font';
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import { NavigationContainer } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Network from 'expo-network';
import { enableScreens } from 'react-native-screens';

enableScreens(true);

const RNText = Text as unknown as { defaultProps?: { style?: unknown } };
RNText.defaultProps = RNText.defaultProps || {};
RNText.defaultProps.style = [
  {
    fontFamily: 'Roboto_400Regular',
  },
  RNText.defaultProps.style,
];
const RNTextInput = TextInput as unknown as { defaultProps?: { style?: unknown } };
RNTextInput.defaultProps = RNTextInput.defaultProps || {};
RNTextInput.defaultProps.style = [
  {
    fontFamily: 'Roboto_400Regular',
  },
  RNTextInput.defaultProps.style,
];

import { initDB } from './src/db/database';
import { getPrets } from './src/db/loanDb';
import { getMateriel, getConsommablesAlerte } from './src/db/inventoryDb';
import { initSupabaseFromStorage } from './src/lib/supabase';
import { loadDataBackendModeFromStorage } from './src/lib/backendModeRuntime';
import { Colors } from './src/theme/colors';
import { AppAuthProvider, useAppAuth } from './src/context/AuthContext';
import { AuthProvider } from './src/context/AuthProvider';
import { useAuth as useSupabaseAuth } from './src/context/AuthProvider';
import { NetworkStatusProvider } from './src/context/NetworkStatusContext';
import {
  reschedulePretReturnReminders,
  requestNotificationPermission,
} from './src/lib/pretNotifications';
import { ensureTrayAndroidChannels } from './src/lib/systemNotificationSetup';
import { maybeSendAutoAlertEmailsIfNeeded } from './src/lib/autoAlertEmails';
import { rescheduleVgpDueReminders } from './src/lib/vgpNotifications';
import { rescheduleSeuilBasReminders } from './src/lib/seuilNotifications';
import { subscribeAutoUpdateChecks } from './src/lib/appAutoUpdate';
import {
  subscribeForegroundInventorySync,
  setForegroundInventorySyncRefreshSession,
} from './src/lib/foregroundInventorySync';
import { ConnectionProvider } from './src/context/ConnectionContext';
import { PairingDeepLinkSubscriber } from './src/components/PairingDeepLinkSubscriber';
import { SupabaseProvisioningDeepLinkSubscriber } from './src/components/SupabaseProvisioningDeepLinkSubscriber';
import { MustChangeDefaultPinModal } from './src/components/MustChangeDefaultPinModal';
import { isConsumerApp } from './src/config/appMode';

import ScannerScreen from './src/screens/ScannerScreen';
import PretsScreen from './src/screens/PretsScreen';
import ConsommablesScreen from './src/screens/ConsommablesScreen';
import LoginScreen from './src/screens/LoginScreen';
import DemandePretScreen from './src/screens/DemandePretScreen';
import MenuHubScreen from './src/screens/MenuHubScreen';
import ActivityHomeScreen from './src/screens/ActivityHomeScreen';
import WorkspaceOnboardingScreen from './src/screens/WorkspaceOnboardingScreen';
import { hasCompletedWorkspaceOnboarding } from './src/lib/workspaceOnboardingStorage';
import { StockStackNavigator, VgpStackNavigator } from './src/navigation/screenStacks';
import {
  WorkspaceStock,
  WorkspaceConsommable,
  WorkspacePret,
  WorkspaceControle,
  WorkspaceParams,
  WorkspaceAlertes,
  WorkspaceImportExport,
  WorkspaceImpression,
  WorkspaceAssistant,
  WorkspaceNotice,
  WorkspaceReseau,
  WorkspaceAccueilPro,
  WorkspaceCompteEmprunteur,
} from './src/navigation/ActivityWorkspaces';
import { DockTabBar } from './src/navigation/DockTabBar';
import { ConnectionStatusBanner } from './src/components/ConnectionStatusBanner';
import { SplashLoadingLogo } from './src/components/SplashLoadingLogo';
import { Typography } from './src/theme/typography';
import { Spacing } from './src/theme/spacing';
import { SaaSRootNavigator } from './src/saas/navigation/SaaSNavigator';
import { startSyncScheduler } from './src/application/sync/SyncScheduler';
import { registerSupabaseDailyKeepAliveTask } from './src/lib/supabaseKeepAliveBackground';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';

import {
  ScanIcon,
  BoxIcon,
  ClipboardIcon,
  CartIcon,
  BellIcon,
  GearIcon,
  VgpIcon,
  NetworkIcon,
  UserIcon,
  InboxIcon,
  BookIcon,
  SparklesIcon,
  MenuIcon,
} from './src/components/Icons';

/** RNGH types omit `children` with React 19; runtime still accepts children. */
const GestureRoot = GestureHandlerRootView as React.ComponentType<
  PropsWithChildren<{ style?: ViewStyle }>
>;

const Tab = createBottomTabNavigator();
const RootStack = createStackNavigator();
const SAAS_MODE_ENABLED = process.env.EXPO_PUBLIC_SAAS_MODE === 'true';

import { effectiveBottomInset } from './src/lib/deviceSafeArea';

type TabBarIconNodeProps = {
  routeName: string;
  color: string;
  size: number;
  focused: boolean;
};

/** Icônes d’onglet mémoïsées : évite de recréer un gros objet à chaque rendu du tab bar. */
const TabBarIconNode = React.memo(function TabBarIconNode({
  routeName,
  color,
  size,
  focused,
}: TabBarIconNodeProps) {
  const iconSize = focused ? Math.max(size, 26) : Math.max(size, 24);
  let node: React.ReactNode = null;
  switch (routeName) {
    case 'Scanner':
      node = <ScanIcon size={iconSize} color={color} />;
      break;
    case 'Stock':
      node = <BoxIcon size={iconSize} color={color} />;
      break;
    case 'Prêts':
      node = <ClipboardIcon size={iconSize} color={color} />;
      break;
    case 'Consom.':
      node = <CartIcon size={iconSize} color={color} />;
      break;
    case 'Alertes':
      node = <BellIcon size={iconSize} color={color} />;
      break;
    case 'VGP':
      node = <VgpIcon size={iconSize} color={color} />;
      break;
    case 'Params':
      node = <GearIcon size={iconSize} color={color} />;
      break;
    case 'Réseau':
      node = <NetworkIcon size={iconSize} color={color} />;
      break;
    case 'Compte':
      node = <UserIcon size={iconSize} color={color} />;
      break;
    case 'Demandes':
      node = <InboxIcon size={iconSize} color={color} />;
      break;
    case 'Historique':
      node = <ClipboardIcon size={iconSize} color={color} />;
      break;
    case 'Notice':
      node = <BookIcon size={iconSize} color={color} />;
      break;
    case 'Assistant':
      node = <SparklesIcon size={iconSize} color={color} />;
      break;
    case 'MenuHub':
      node = <MenuIcon size={iconSize} color={color} />;
      break;
    case 'Utilisateur':
      node = <UserIcon size={iconSize} color={color} />;
      break;
    case 'ImportExport':
      node = <ClipboardIcon size={iconSize} color={color} />;
      break;
    default:
      break;
  }
  if (!node) return null;
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 48,
        minHeight: 40,
        borderRadius: 14,
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? 'rgba(52, 211, 153, 0.25)' : 'transparent',
        backgroundColor: focused ? Colors.tabIconActiveBg : 'transparent',
      }}
    >
      {node}
    </View>
  );
});

function MainTabs() {
  const { user } = useAppAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomPad = effectiveBottomInset(insets.bottom);
  const tabBarHeight = 60 + bottomPad;

  const screenOptions = useCallback(
    ({ route }: { route: { name: string } }) => ({
      headerShown: false,
      tabBar: (props: BottomTabBarProps) => <DockTabBar {...props} />,
      tabBarHideOnKeyboard: true,
      lazy: true,
      tabBarStyle: {
        backgroundColor: Colors.bg,
        borderTopWidth: 0,
        minHeight: tabBarHeight,
        height: tabBarHeight,
        paddingBottom: 0,
        paddingTop: 0,
        paddingHorizontal: 0,
      },
      tabBarItemStyle: {
        paddingVertical: 4,
        minWidth: 64,
        maxWidth: 140,
      },
      tabBarIconStyle: { marginTop: 2 },
      tabBarActiveTintColor: Colors.green,
      tabBarInactiveTintColor: Colors.tabBarInactive,
      tabBarLabelStyle: styles.tabLabel,
      tabBarIcon: ({
        color,
        size,
        focused,
      }: {
        color: string;
        size: number;
        focused: boolean;
      }) => (
        <TabBarIconNode
          routeName={route.name}
          color={color}
          size={size}
          focused={focused}
        />
      ),
    }),
    [bottomPad, tabBarHeight, t]
  );

  if (user?.role === 'emprunteur') {
    return (
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Prêts" component={PretsScreen} options={{ tabBarLabel: t('tab.loans') }} />
        <Tab.Screen name="MenuHub" component={MenuHubScreen} options={{ tabBarLabel: t('tab.menu') }} />
        <Tab.Screen
          name="Compte"
          getComponent={() => require('./src/screens/EmprunteurCompteScreen').default}
          options={{ tabBarLabel: t('tab.account') }}
        />
        <Tab.Screen
          name="Assistant"
          getComponent={() => require('./src/screens/AssistantScreen').default}
          options={{ tabBarLabel: t('tab.ai') }}
        />
        <Tab.Screen
          name="Notice"
          getComponent={() => require('./src/screens/NoticeUtilisateurScreen').default}
          options={{ tabBarLabel: t('tab.notice') }}
        />
        <Tab.Screen
          name="Réseau"
          getComponent={() => require('./src/screens/NetworkScreen').default}
          options={{ tabBarLabel: isConsumerApp() ? t('tab.connection') : t('tab.network') }}
        />
        <Tab.Screen
          name="Params"
          getComponent={() => require('./src/screens/ParamsScreen').default}
          options={{ tabBarLabel: t('tab.settings') }}
        />
        <Tab.Screen
          name="Utilisateur"
          getComponent={() => require('./src/screens/UserProfileScreen').default}
          options={{ tabBarLabel: t('tab.user') }}
        />
        <Tab.Screen
          name="ImportExport"
          getComponent={() => require('./src/screens/ImportExportScreen').default}
          options={{ tabBarLabel: t('tab.importExport') }}
        />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator
      initialRouteName="Stock"
      screenOptions={screenOptions}
      /** Onglets centraux (Scanner, Stock, Consom.) montés en priorité pour accès rapide. */
      backBehavior="history"
    >
      <Tab.Screen name="Scanner" component={ScannerScreen} options={{ tabBarLabel: t('tab.scan') }} />
      <Tab.Screen name="Stock" component={StockStackNavigator} options={{ tabBarLabel: t('tab.stock') }} />
      <Tab.Screen name="Consom." component={ConsommablesScreen} options={{ tabBarLabel: t('tab.consumables') }} />
      <Tab.Screen name="Prêts" component={PretsScreen} options={{ tabBarLabel: t('tab.loans') }} />
      {user?.role === 'admin' && (
        <Tab.Screen name="Demandes" component={DemandePretScreen} options={{ tabBarLabel: t('tab.requests') }} />
      )}
      <Tab.Screen name="MenuHub" component={MenuHubScreen} options={{ tabBarLabel: t('tab.menu') }} />
      <Tab.Screen
        name="Assistant"
        getComponent={() => require('./src/screens/AssistantScreen').default}
        options={{
          tabBarLabel: t('tab.ai'),
          /** Précharge l’écran IA ; ne pas geler au blur pour rester réactif au retour sur l’onglet. */
          lazy: false,
          freezeOnBlur: false,
        }}
      />
      <Tab.Screen
        name="Historique"
        getComponent={() => require('./src/screens/HistoriqueStockScreen').default}
        options={{ tabBarLabel: t('tab.history') }}
      />
      <Tab.Screen
        name="Alertes"
        getComponent={() => require('./src/screens/AlertesScreen').default}
        options={{ tabBarLabel: t('tab.alerts') }}
      />
      <Tab.Screen name="VGP" component={VgpStackNavigator} options={{ tabBarLabel: t('tab.vgp') }} />
      <Tab.Screen
        name="Notice"
        getComponent={() => require('./src/screens/NoticeUtilisateurScreen').default}
        options={{ tabBarLabel: t('tab.notice') }}
      />
      <Tab.Screen
        name="Réseau"
        getComponent={() => require('./src/screens/NetworkScreen').default}
        options={{ tabBarLabel: isConsumerApp() ? t('tab.connection') : t('tab.network') }}
      />
      <Tab.Screen
        name="Params"
        getComponent={() => require('./src/screens/ParamsScreen').default}
        options={{ tabBarLabel: t('tab.settings') }}
      />
      <Tab.Screen
        name="Utilisateur"
        getComponent={() => require('./src/screens/UserProfileScreen').default}
        options={{ tabBarLabel: t('tab.user') }}
      />
      <Tab.Screen
        name="ImportExport"
        getComponent={() => require('./src/screens/ImportExportScreen').default}
        options={{ tabBarLabel: t('tab.importExport') }}
      />
    </Tab.Navigator>
  );
}

/** Vérifie les mises à jour OTA + APK (sans bloquer l’UI). */
function LoggedInNavigator() {
  const [onboardingInit, setOnboardingInit] = useState<null | 'onboarding' | 'main'>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const done = await hasCompletedWorkspaceOnboarding();
      if (!cancel) {
        setOnboardingInit(!done ? 'onboarding' : 'main');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (onboardingInit === null) {
    return (
      <View style={styles.splash}>
        <SplashLoadingLogo size={100} style={{ marginBottom: Spacing.md }} />
        <ActivityIndicator color={Colors.green} size="small" />
      </View>
    );
  }

  return (
    <RootStack.Navigator
      key={onboardingInit}
      initialRouteName={onboardingInit === 'onboarding' ? 'WorkspaceOnboarding' : 'ActivityHome'}
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="WorkspaceOnboarding" component={WorkspaceOnboardingScreen} />
      <RootStack.Screen name="ActivityHome" component={ActivityHomeScreen} />
      <RootStack.Screen name="FullApp" component={MainTabs} />
      <RootStack.Screen name="QuickSearch" getComponent={() => require('./src/screens/QuickSearchScreen').default} />
      <RootStack.Screen name="ProfileEditor" getComponent={() => require('./src/screens/ProfileEditorScreen').default} />
      <RootStack.Screen name="TourList" getComponent={() => require('./src/screens/TourListScreen').default} />
      <RootStack.Screen name="TourDetail" getComponent={() => require('./src/screens/TourDetailScreen').default} />
      <RootStack.Screen name="TourReturnScan" getComponent={() => require('./src/screens/TourReturnScanScreen').default} />
      <RootStack.Screen name="Tracking" getComponent={() => require('./src/screens/TrackingScreen').default} />
      <RootStack.Screen name="ActivityLog" getComponent={() => require('./src/screens/ActivityLogScreen').default} />
      <RootStack.Screen name="ConduiteList" getComponent={() => require('./src/screens/ConduiteListScreen').default} />
      <RootStack.Screen name="ConduiteDetail" getComponent={() => require('./src/screens/ConduiteDetailScreen').default} />
      <RootStack.Screen name="ConduiteLive" getComponent={() => require('./src/screens/ConduiteLiveScreen').default} />
      <RootStack.Screen name="MiseTechniqueList" getComponent={() => require('./src/screens/MiseTechniqueListScreen').default} />
      <RootStack.Screen name="MiseTechniqueDetail" getComponent={() => require('./src/screens/MiseTechniqueDetailScreen').default} />
      <RootStack.Screen name="WorkspaceStock" component={WorkspaceStock} />
      <RootStack.Screen name="WorkspaceConsommable" component={WorkspaceConsommable} />
      <RootStack.Screen name="WorkspacePret" component={WorkspacePret} />
      <RootStack.Screen name="WorkspaceControle" component={WorkspaceControle} />
      <RootStack.Screen name="WorkspaceParams" component={WorkspaceParams} />
      <RootStack.Screen name="WorkspaceAlertes" component={WorkspaceAlertes} />
      <RootStack.Screen name="WorkspaceImportExport" component={WorkspaceImportExport} />
      <RootStack.Screen name="WorkspaceImpression" component={WorkspaceImpression} />
      <RootStack.Screen name="WorkspaceAssistant" component={WorkspaceAssistant} />
      <RootStack.Screen name="WorkspaceNotice" component={WorkspaceNotice} />
      <RootStack.Screen name="WorkspaceReseau" component={WorkspaceReseau} />
      <RootStack.Screen name="WorkspaceAccueilPro" component={WorkspaceAccueilPro} />
      <RootStack.Screen name="WorkspaceCompteEmprunteur" component={WorkspaceCompteEmprunteur} />
    </RootStack.Navigator>
  );
}

function AppAutoUpdateSubscriber() {
  useEffect(() => subscribeAutoUpdateChecks(), []);
  return null;
}

/** E-mails d’alerte automatiques (Wi‑Fi / données) lorsque le réseau ou les alertes changent. */
function AutoAlertEmailSubscriber() {
  const { user } = useAppAuth();
  useEffect(() => {
    if (!user || user.role === 'emprunteur') return undefined;
    const sub = Network.addNetworkStateListener(() => {
      void maybeSendAutoAlertEmailsIfNeeded();
    });
    void maybeSendAutoAlertEmailsIfNeeded();
    return () => sub.remove();
  }, [user?.id, user?.role]);
  return null;
}

/** Synchro inventaire à chaque retour au premier plan (API joignable). */
function ForegroundInventorySyncSubscriber() {
  const { user, refreshSession } = useAppAuth();
  useEffect(() => {
    setForegroundInventorySyncRefreshSession(refreshSession);
    return () => setForegroundInventorySyncRefreshSession(null);
  }, [refreshSession]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribeForegroundInventorySync();
  }, [user?.id]);
  return null;
}

function OfflineSyncSchedulerSubscriber() {
  const { user } = useAppAuth();
  useEffect(() => {
    if (!user) return undefined;
    return startSyncScheduler(30000);
  }, [user?.id]);
  return null;
}

function SupabaseDailyKeepAliveSubscriber() {
  const { user } = useAppAuth();
  useEffect(() => {
    if (!user) return;
    void registerSupabaseDailyKeepAliveTask();
  }, [user?.id]);
  return null;
}

function AppNavigation() {
  const { user, loading: authLoading, mustChangeDefaultPin, submitNewPin } = useAppAuth();

  useEffect(() => {
    if (!user) return;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const [prets, mats, seuils] = await Promise.all([
          getPrets(),
          getMateriel(),
          getConsommablesAlerte(),
        ]);
        await Promise.all([
          reschedulePretReturnReminders(prets),
          rescheduleVgpDueReminders(mats),
          rescheduleSeuilBasReminders(seuils),
        ]);
      })().catch(() => undefined);
      void maybeSendAutoAlertEmailsIfNeeded();
    });
    const notifTimer = setTimeout(() => {
      void (async () => {
        await requestNotificationPermission();
        await ensureTrayAndroidChannels();
      })().catch(() => undefined);
    }, 1200);
    return () => {
      interactionTask.cancel();
      clearTimeout(notifTimer);
    };
  }, [user?.id]);

  if (authLoading) {
    return (
      <View style={styles.splash}>
        <SplashLoadingLogo size={120} />
        <ActivityIndicator color={Colors.green} size="small" style={{ marginTop: Spacing.lg }} />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: Colors.green,
          background: Colors.bg,
          card: Colors.bgElevated,
          text: Colors.textPrimary,
          border: Colors.separator,
          notification: Colors.red,
        },
      }}
    >
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ConnectionStatusBanner />
        <View style={{ flex: 1 }}>
          <ForegroundInventorySyncSubscriber />
          <OfflineSyncSchedulerSubscriber />
          <SupabaseDailyKeepAliveSubscriber />
          <AutoAlertEmailSubscriber />
          <StatusBar style="light" backgroundColor={Colors.bg} />
          <LoggedInNavigator />
        </View>
        <MustChangeDefaultPinModal
          visible={mustChangeDefaultPin}
          userName={user.nom}
          onSubmit={submitNewPin}
        />
      </View>
    </NavigationContainer>
  );
}

function SaaSAppNavigation() {
  const { loading, session } = useSupabaseAuth();
  if (loading) {
    return (
      <View style={styles.splash}>
        <SplashLoadingLogo size={120} />
        <ActivityIndicator color={Colors.green} size="small" style={{ marginTop: Spacing.lg }} />
      </View>
    );
  }
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: Colors.green,
          background: Colors.bg,
          card: Colors.bgElevated,
          text: Colors.textPrimary,
          border: Colors.separator,
          notification: Colors.red,
        },
      }}
    >
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <SaaSRootNavigator authenticated={Boolean(session)} />
    </NavigationContainer>
  );
}

function AppWithLanguageLoaded() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const runInit = useCallback(() => {
    setError(null);
    setLoading(true);
    initDB()
      .then(() => {
        setLoading(false);
        void initSupabaseFromStorage().catch(() => undefined);
        void loadDataBackendModeFromStorage().catch(() => undefined);
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    runInit();
  }, [runInit]);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.splash}>
        <SplashLoadingLogo size={140} style={{ marginBottom: Spacing.md }} />
        <Text style={styles.splashTitle} accessibilityRole="header">
          {t('app.splash.productName')}
        </Text>
        <Text style={styles.splashSubtitle}>{t('app.initDb')}</Text>
        <ActivityIndicator color={Colors.green} size="small" style={{ marginTop: Spacing.lg }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.splash} accessibilityRole="alert">
        <Text style={styles.splashTitle}>{t('app.dbErrorTitle')}</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Text style={styles.errorHint}>{t('app.dbErrorHint')}</Text>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
          onPress={runInit}
          accessibilityRole="button"
          accessibilityLabel={t('app.retryInitA11y')}
        >
          <Text style={styles.retryBtnText}>{t('app.retryInit')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GestureRoot style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ConnectionProvider>
          <PairingDeepLinkSubscriber />
          <AppAuthProvider>
            <NetworkStatusProvider>
                <AuthProvider>
                  <SupabaseProvisioningDeepLinkSubscriber />
                  {SAAS_MODE_ENABLED ? (
                    <SaaSAppNavigation />
                  ) : (
                    <>
                      <AppAutoUpdateSubscriber />
                      <AppNavigation />
                    </>
                  )}
                </AuthProvider>
              </NetworkStatusProvider>
          </AppAuthProvider>
        </ConnectionProvider>
      </SafeAreaProvider>
    </GestureRoot>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppWithLanguageLoaded />
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  splashTitle: {
    ...Typography.screenTitle,
    fontSize: 26,
    textAlign: 'center',
  },
  splashSubtitle: {
    ...Typography.bodySecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  errorDetail: {
    ...Typography.body,
    color: Colors.red,
    marginTop: Spacing.md,
    textAlign: 'center',
    fontSize: 14,
  },
  errorHint: {
    ...Typography.caption,
    marginTop: Spacing.lg,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: Spacing.xxl,
    backgroundColor: Colors.green,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: 14,
    minWidth: 200,
    alignItems: 'center',
  },
  retryBtnText: {
    color: Colors.white,
    ...Typography.button,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 2,
    marginBottom: 2,
    textAlign: 'center',
  },
});
