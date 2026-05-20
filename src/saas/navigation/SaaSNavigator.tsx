import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text } from 'react-native';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useRbac } from '../hooks/useRbac';
import type { AppRole, Plan } from '../types';

function Placeholder({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
      <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '700' }}>{title}</Text>
    </View>
  );
}

function LoginScreen() {
  return <Placeholder title="Auth / Login" />;
}

function HomeScreen() {
  return <Placeholder title="Home Dashboard" />;
}

function StockScreen() {
  return <Placeholder title="Stock Module" />;
}

function ToursScreen() {
  return <Placeholder title="Tours Module" />;
}

function AlertsScreen() {
  return <Placeholder title="Alerts Module" />;
}

function ProfileScreen() {
  return <Placeholder title="Profile & Billing" />;
}

const AuthStack = createStackNavigator();
const AppTabs = createBottomTabNavigator();
const RootStack = createStackNavigator();

export function SaaSAuthStack() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

export function SaaSAppTabs({ role, plan }: { role?: AppRole | null; plan?: Plan | null }) {
  const { flags, loading } = useFeatureFlags();
  const permissions = useRbac(role, plan, flags);

  if (loading) {
    return <Placeholder title="Loading feature flags..." />;
  }

  return (
    <AppTabs.Navigator screenOptions={{ headerShown: false }}>
      <AppTabs.Screen name="Home" component={HomeScreen} />
      {permissions.manageStock && <AppTabs.Screen name="Stock" component={StockScreen} />}
      {flags['saas.tourMode'] && permissions.assignProductsToTour && (
        <AppTabs.Screen name="Tours" component={ToursScreen} />
      )}
      {permissions.reportIssues && <AppTabs.Screen name="Alerts" component={AlertsScreen} />}
      <AppTabs.Screen name="Profile" component={ProfileScreen} />
    </AppTabs.Navigator>
  );
}

export function SaaSRootNavigator({
  authenticated,
  role,
  plan,
}: {
  authenticated: boolean;
  role?: AppRole | null;
  plan?: Plan | null;
}) {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {authenticated ? (
        <RootStack.Screen name="AppTabs">
          {() => <SaaSAppTabs role={role} plan={plan} />}
        </RootStack.Screen>
      ) : (
        <RootStack.Screen name="AuthStack" component={SaaSAuthStack} />
      )}
    </RootStack.Navigator>
  );
}
