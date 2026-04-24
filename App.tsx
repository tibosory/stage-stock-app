// App.tsx
import 'react-native-url-polyfill/auto';
import './src/lib/systemNotificationSetup';
import React, { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Pressable,
  type ViewStyle,
} from 'react-native';
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

import { initDB, getPrets, getMateriel, getConsommablesAlerte } from './src/db/database';
import { initSupabaseFromStorage } from './src/lib/supabase';
import { Colors } from './src/theme/colors';
import { AppAuthProvider, useAppAuth } from './src/context/AuthContext';
import { AuthProvider } from './src/context/AuthProvider';
import { SpecialtyProvider } from './src/context/SpecialtyContext';
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
import { isConsumerApp } from './src/config/appMode';

import ScannerScreen from './src/screens/ScannerScreen';
import PretsScreen from './src/screens/PretsScreen';
import ConsommablesScreen from './src/screens/ConsommablesScreen';
import AlertesScreen from './src/screens/AlertesScreen';
import ParamsScreen from './src/screens/ParamsScreen';
import NetworkScreen from './src/screens/NetworkScreen';
import LoginScreen from './src/screens/LoginScreen';
import EmprunteurCompteScreen from './src/screens/EmprunteurCompteScreen';
import DemandePretScreen from './src/screens/DemandePretScreen';
import HistoriqueStockScreen from './src/screens/HistoriqueStockScreen';
import NoticeUtilisateurScreen from './src/screens/NoticeUtilisateurScreen';
import AssistantScreen from './src/screens/AssistantScreen';
import MenuHubScreen from './src/screens/MenuHubScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import ImportExportScreen from './src/screens/ImportExportScreen';
import ActivityHomeScreen from './src/screens/ActivityHomeScreen';
import WorkspaceOnboardingScreen from './src/screens/WorkspaceOnboardingScreen';
import QuickSearchScreen from './src/screens/QuickSearchScreen';
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
  WorkspaceCompteEmprunteur,
} from './src/navigation/ActivityWorkspaces';
import { DockTabBar } from './src/navigation/DockTabBar';
import { ConnectionStatusBanner } from './src/components/ConnectionStatusBanner';
import { SplashLoadingLogo } from './src/components/SplashLoadingLogo';
import { Typography } from './src/theme/typography';
import { Spacing } from './src/theme/spacing';

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

/** Samsung / Android navigation « 3 boutons » : safe-area bottom souvent 0 — marge mini pour labels + icônes */
const ANDROID_BOTTOM_NAV_MIN_DP = 52;

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
  const insets = useSafeAreaInsets();
  const bottomPad =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, ANDROID_BOTTOM_NAV_MIN_DP)
      : Math.max(insets.bottom, 12);
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
        paddingBottom: bottomPad,
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
    [bottomPad, tabBarHeight]
  );

  if (user?.role === 'emprunteur') {
    return (
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Prêts" component={PretsScreen} />
        <Tab.Screen name="MenuHub" component={MenuHubScreen} options={{ tabBarLabel: 'Menu' }} />
        <Tab.Screen name="Compte" component={EmprunteurCompteScreen} />
        <Tab.Screen name="Assistant" component={AssistantScreen} options={{ tabBarLabel: 'IA' }} />
        <Tab.Screen name="Notice" component={NoticeUtilisateurScreen} options={{ tabBarLabel: 'Notice' }} />
        <Tab.Screen
          name="Réseau"
          component={NetworkScreen}
          options={{ tabBarLabel: isConsumerApp() ? 'Connexion' : 'Réseau' }}
        />
        <Tab.Screen name="Params" component={ParamsScreen} options={{ tabBarLabel: 'Paramètres' }} />
        <Tab.Screen name="Utilisateur" component={UserProfileScreen} options={{ tabBarLabel: 'Utilisateur' }} />
        <Tab.Screen name="ImportExport" component={ImportExportScreen} options={{ tabBarLabel: 'Import / export' }} />
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
      <Tab.Screen name="Scanner" component={ScannerScreen} options={{ tabBarLabel: 'Scan' }} />
      <Tab.Screen name="Stock" component={StockStackNavigator} />
      <Tab.Screen name="Consom." component={ConsommablesScreen} options={{ tabBarLabel: 'Consom.' }} />
      <Tab.Screen name="Prêts" component={PretsScreen} />
      {user?.role === 'admin' && (
        <Tab.Screen name="Demandes" component={DemandePretScreen} options={{ tabBarLabel: 'Demandes' }} />
      )}
      <Tab.Screen name="MenuHub" component={MenuHubScreen} options={{ tabBarLabel: 'Menu' }} />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{
          tabBarLabel: 'IA',
          /** Précharge l’écran IA ; ne pas geler au blur pour rester réactif au retour sur l’onglet. */
          lazy: false,
          freezeOnBlur: false,
        }}
      />
      <Tab.Screen name="Historique" component={HistoriqueStockScreen} options={{ tabBarLabel: 'Historique' }} />
      <Tab.Screen name="Alertes" component={AlertesScreen} />
      <Tab.Screen name="VGP" component={VgpStackNavigator} />
      <Tab.Screen name="Notice" component={NoticeUtilisateurScreen} options={{ tabBarLabel: 'Notice' }} />
      <Tab.Screen
        name="Réseau"
        component={NetworkScreen}
        options={{ tabBarLabel: isConsumerApp() ? 'Connexion' : 'Réseau' }}
      />
      <Tab.Screen name="Params" component={ParamsScreen} options={{ tabBarLabel: 'Paramètres' }} />
      <Tab.Screen name="Utilisateur" component={UserProfileScreen} options={{ tabBarLabel: 'Utilisateur' }} />
      <Tab.Screen name="ImportExport" component={ImportExportScreen} options={{ tabBarLabel: 'Import / export' }} />
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
      if (!cancel) setOnboardingInit(done ? 'main' : 'onboarding');
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
      <RootStack.Screen name="QuickSearch" component={QuickSearchScreen} />
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

function AppNavigation() {
  const { user, loading: authLoading } = useAppAuth();

  useEffect(() => {
    if (!user) return;
    void (async () => {
      await requestNotificationPermission();
      await ensureTrayAndroidChannels();
    })();
    getPrets().then(prets => reschedulePretReturnReminders(prets));
    getMateriel().then(m => rescheduleVgpDueReminders(m));
    getConsommablesAlerte().then(c => rescheduleSeuilBasReminders(c));
    void maybeSendAutoAlertEmailsIfNeeded();
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
          <AutoAlertEmailSubscriber />
          <StatusBar style="light" backgroundColor={Colors.bg} />
          <LoggedInNavigator />
        </View>
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runInit = useCallback(() => {
    setError(null);
    setLoading(true);
    initDB()
      .then(() => initSupabaseFromStorage())
      .then(() => setLoading(false))
      .catch(e => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    runInit();
  }, [runInit]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <SplashLoadingLogo size={140} style={{ marginBottom: Spacing.md }} />
        <Text style={styles.splashTitle} accessibilityRole="header">
          Stage Stock
        </Text>
        <Text style={styles.splashSubtitle}>Initialisation de la base locale…</Text>
        <ActivityIndicator color={Colors.green} size="small" style={{ marginTop: Spacing.lg }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.splash} accessibilityRole="alert">
        <Text style={styles.splashTitle}>Base de données</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Text style={styles.errorHint}>
          Réessayez après avoir libéré de l’espace ou fermé d’autres apps. Si le problème
          persiste, réinstallez l’application (les données locales seront perdues).
        </Text>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
          onPress={runInit}
          accessibilityRole="button"
          accessibilityLabel="Réessayer l’initialisation de la base de données"
        >
          <Text style={styles.retryBtnText}>Réessayer</Text>
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
            <SpecialtyProvider>
              <AuthProvider>
                <AppAutoUpdateSubscriber />
                <AppNavigation />
              </AuthProvider>
            </SpecialtyProvider>
          </AppAuthProvider>
        </ConnectionProvider>
      </SafeAreaProvider>
    </GestureRoot>
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
