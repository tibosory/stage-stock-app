// App.tsx
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, type PropsWithChildren } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, Platform, type ViewStyle,
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
import { enableScreens } from 'react-native-screens';

enableScreens(true);

import { initDB, getPrets, getMateriel } from './src/db/database';
import { Colors } from './src/theme/colors';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SupabaseAuthProvider } from './src/context/SupabaseAuthContext';
import { reschedulePretReturnReminders } from './src/lib/pretNotifications';
import { rescheduleVgpDueReminders } from './src/lib/vgpNotifications';
import { subscribeAutoUpdateChecks } from './src/lib/appAutoUpdate';
import { subscribeForegroundInventorySync } from './src/lib/foregroundInventorySync';
import { ConnectionProvider } from './src/context/ConnectionContext';
import { isConsumerApp } from './src/config/appMode';

import ScannerScreen from './src/screens/ScannerScreen';
import StockScreen from './src/screens/StockScreen';
import PretsScreen from './src/screens/PretsScreen';
import ConsommablesScreen from './src/screens/ConsommablesScreen';
import AlertesScreen from './src/screens/AlertesScreen';
import ParamsScreen from './src/screens/ParamsScreen';
import NetworkScreen from './src/screens/NetworkScreen';
import MaterielDetailScreen from './src/screens/MaterielDetailScreen';
import VgpScreen from './src/screens/VgpScreen';
import LoginScreen from './src/screens/LoginScreen';
import EmprunteurCompteScreen from './src/screens/EmprunteurCompteScreen';
import DemandePretScreen from './src/screens/DemandePretScreen';
import HistoriqueStockScreen from './src/screens/HistoriqueStockScreen';
import NoticeUtilisateurScreen from './src/screens/NoticeUtilisateurScreen';
import AssistantScreen from './src/screens/AssistantScreen';
import { DockTabBar } from './src/navigation/DockTabBar';

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
} from './src/components/Icons';

/** RNGH types omit `children` with React 19; runtime still accepts children. */
const GestureRoot = GestureHandlerRootView as React.ComponentType<
  PropsWithChildren<{ style?: ViewStyle }>
>;

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function StockStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StockList" component={StockScreen} />
      <Stack.Screen name="MaterielDetail" component={MaterielDetailScreen} />
    </Stack.Navigator>
  );
}

function VgpStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VgpList" component={VgpScreen} />
      <Stack.Screen name="MaterielDetail" component={MaterielDetailScreen} />
    </Stack.Navigator>
  );
}

/** Samsung / Android navigation « 3 boutons » : safe-area bottom souvent 0 — marge mini pour labels + icônes */
const ANDROID_BOTTOM_NAV_MIN_DP = 52;

function MainTabs() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPad =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, ANDROID_BOTTOM_NAV_MIN_DP)
      : Math.max(insets.bottom, 12);
  const tabBarHeight = 60 + bottomPad;

  const screenOptions = ({ route }: { route: { name: string } }) => ({
    headerShown: false,
    tabBar: (props: BottomTabBarProps) => <DockTabBar {...props} />,
    tabBarHideOnKeyboard: true,
    lazy: true,
    tabBarStyle: {
      backgroundColor: Colors.tabBar,
      borderTopColor: Colors.separator,
      borderTopWidth: StyleSheet.hairlineWidth,
      minHeight: tabBarHeight,
      height: tabBarHeight,
      paddingBottom: bottomPad,
      paddingTop: 6,
      paddingHorizontal: 4,
    },
    tabBarItemStyle: {
      paddingVertical: 4,
      minWidth: 64,
      maxWidth: 140,
    },
    tabBarIconStyle: { marginTop: 2 },
    tabBarActiveTintColor: Colors.textPrimary,
    tabBarInactiveTintColor: Colors.tabBarInactive,
    tabBarLabelStyle: styles.tabLabel,
    tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => {
      const iconSize = focused ? Math.max(size, 26) : Math.max(size, 24);
      const icons: Record<string, React.ReactNode> = {
        Scanner: <ScanIcon size={iconSize} color={color} />,
        Stock: <BoxIcon size={iconSize} color={color} />,
        Prêts: <ClipboardIcon size={iconSize} color={color} />,
        'Consom.': <CartIcon size={iconSize} color={color} />,
        Alertes: <BellIcon size={iconSize} color={color} />,
        VGP: <VgpIcon size={iconSize} color={color} />,
        Params: <GearIcon size={iconSize} color={color} />,
        Réseau: <NetworkIcon size={iconSize} color={color} />,
        Compte: <UserIcon size={iconSize} color={color} />,
        Demandes: <InboxIcon size={iconSize} color={color} />,
        Historique: <ClipboardIcon size={iconSize} color={color} />,
        Notice: <BookIcon size={iconSize} color={color} />,
        Assistant: <SparklesIcon size={iconSize} color={color} />,
      };
      const node = icons[route.name];
      if (!node) return null;
      return (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 48,
            minHeight: 40,
            borderRadius: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: focused ? Colors.border : 'transparent',
            backgroundColor: focused ? 'rgba(255,255,255,0.06)' : 'transparent',
          }}
        >
          {node}
        </View>
      );
    },
  });

  if (user?.role === 'emprunteur') {
    return (
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Prêts" component={PretsScreen} />
        <Tab.Screen name="Assistant" component={AssistantScreen} options={{ tabBarLabel: 'IA' }} />
        <Tab.Screen name="Notice" component={NoticeUtilisateurScreen} options={{ tabBarLabel: 'Notice' }} />
        <Tab.Screen
          name="Réseau"
          component={NetworkScreen}
          options={{ tabBarLabel: isConsumerApp() ? 'Connexion' : 'Réseau' }}
        />
        <Tab.Screen name="Params" component={ParamsScreen} options={{ tabBarLabel: 'Paramètres' }} />
        <Tab.Screen name="Compte" component={EmprunteurCompteScreen} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Scanner" component={ScannerScreen} />
      <Tab.Screen name="Assistant" component={AssistantScreen} options={{ tabBarLabel: 'IA' }} />
      <Tab.Screen name="Stock" component={StockStack} />
      <Tab.Screen name="Prêts" component={PretsScreen} />
      {user?.role === 'admin' && (
        <Tab.Screen name="Demandes" component={DemandePretScreen} options={{ tabBarLabel: 'Demandes' }} />
      )}
      <Tab.Screen name="Consom." component={ConsommablesScreen} />
      <Tab.Screen name="Historique" component={HistoriqueStockScreen} options={{ tabBarLabel: 'Historique' }} />
      <Tab.Screen name="Alertes" component={AlertesScreen} />
      <Tab.Screen name="VGP" component={VgpStack} />
      <Tab.Screen name="Notice" component={NoticeUtilisateurScreen} options={{ tabBarLabel: 'Notice' }} />
      <Tab.Screen
        name="Réseau"
        component={NetworkScreen}
        options={{ tabBarLabel: isConsumerApp() ? 'Connexion' : 'Réseau' }}
      />
      <Tab.Screen name="Params" component={ParamsScreen} options={{ tabBarLabel: 'Paramètres' }} />
    </Tab.Navigator>
  );
}

/** Vérifie les mises à jour OTA + APK (sans bloquer l’UI). */
function AppAutoUpdateSubscriber() {
  useEffect(() => subscribeAutoUpdateChecks(), []);
  return null;
}

/** Synchro inventaire à chaque retour au premier plan (API joignable). */
function ForegroundInventorySyncSubscriber() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return undefined;
    return subscribeForegroundInventorySync();
  }, [user?.id]);
  return null;
}

function AppNavigation() {
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!user) return;
    getPrets().then(prets => reschedulePretReturnReminders(prets));
    getMateriel().then(m => rescheduleVgpDueReminders(m));
  }, [user?.id]);

  if (authLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={Colors.green} size="large" />
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
      <ForegroundInventorySyncSubscriber />
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <MainTabs />
    </NavigationContainer>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDB()
      .then(() => setLoading(false))
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>📦 Stage Stock</Text>
        <ActivityIndicator color={Colors.green} size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Erreur</Text>
        <Text style={{ color: Colors.red, marginTop: 8 }}>{error}</Text>
      </View>
    );
  }

  return (
    <GestureRoot style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ConnectionProvider>
          <AuthProvider>
            <SupabaseAuthProvider>
              <AppAutoUpdateSubscriber />
              <AppNavigation />
            </SupabaseAuthProvider>
          </AuthProvider>
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
  },
  splashTitle: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: 'bold',
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
