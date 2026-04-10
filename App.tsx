// App.tsx
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, type PropsWithChildren } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { initDB, getPrets } from './src/db/database';
import { Colors } from './src/theme/colors';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { reschedulePretReturnReminders } from './src/lib/pretNotifications';

import ScannerScreen from './src/screens/ScannerScreen';
import StockScreen from './src/screens/StockScreen';
import PretsScreen from './src/screens/PretsScreen';
import ConsommablesScreen from './src/screens/ConsommablesScreen';
import AlertesScreen from './src/screens/AlertesScreen';
import ParamsScreen from './src/screens/ParamsScreen';
import MaterielDetailScreen from './src/screens/MaterielDetailScreen';
import LoginScreen from './src/screens/LoginScreen';

import {
  ScanIcon, BoxIcon, ClipboardIcon, CartIcon, BellIcon, GearIcon
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

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, React.ReactNode> = {
            Scanner: <ScanIcon size={size} color={color} />,
            Stock: <BoxIcon size={size} color={color} />,
            Prêts: <ClipboardIcon size={size} color={color} />,
            'Consom.': <CartIcon size={size} color={color} />,
            Alertes: <BellIcon size={size} color={color} />,
            Params: <GearIcon size={size} color={color} />,
          };
          return icons[route.name] ?? null;
        },
      })}
    >
      <Tab.Screen name="Scanner" component={ScannerScreen} />
      <Tab.Screen name="Stock" component={StockStack} />
      <Tab.Screen name="Prêts" component={PretsScreen} />
      <Tab.Screen name="Consom." component={ConsommablesScreen} />
      <Tab.Screen name="Alertes" component={AlertesScreen} />
      <Tab.Screen name="Params" component={ParamsScreen} />
    </Tab.Navigator>
  );
}

function AppNavigation() {
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!user) return;
    getPrets().then(prets => reschedulePretReturnReminders(prets));
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
    <NavigationContainer>
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
        <AuthProvider>
          <AppNavigation />
        </AuthProvider>
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
  tabBar: {
    backgroundColor: Colors.tabBar,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
