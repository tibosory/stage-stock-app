import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import StockScreen from '../screens/StockScreen';
import StockBrowseScreen from '../screens/StockBrowseScreen';
import MaterielDetailScreen from '../screens/MaterielDetailScreen';
import VgpScreen from '../screens/VgpScreen';

const Stack = createStackNavigator();

/**
 * Même structure que l’onglet Stock / VGP (listes + fiche) — partagé avec les espaces « activité ».
 */
export function StockStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StockList" component={StockScreen} />
      <Stack.Screen name="StockBrowse" component={StockBrowseScreen} />
      <Stack.Screen name="MaterielDetail" component={MaterielDetailScreen} />
    </Stack.Navigator>
  );
}

export function VgpStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VgpList" component={VgpScreen} />
      <Stack.Screen name="MaterielDetail" component={MaterielDetailScreen} />
    </Stack.Navigator>
  );
}
