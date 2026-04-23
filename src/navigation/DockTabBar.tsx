import React, { useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { Route } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { useAppAuth } from '../context/AuthContext';
import {
  EMPRUNTEUR_VISIBLE_TAB_NAMES,
  menuHubTabIsFocused,
  staffVisibleTabNames,
} from './mainMenuConfig';

const ANDROID_BOTTOM_NAV_MIN_DP = 52;

type TabRoute = Route<string>;

/**
 * Barre fixe : peu d’onglets (Scanner, Stock, Prêts, [Demandes], Menu) — pas de défilement ni de ⋮.
 * Les autres écrans s’ouvrent depuis l’écran « Menu » ; l’onglet Menu reste visuellement actif sur ces routes.
 */
export function DockTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAppAuth();

  const bottomPad =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, ANDROID_BOTTOM_NAV_MIN_DP)
      : Math.max(insets.bottom, 12);
  const tabBarHeight = 60 + bottomPad;

  const visibleNames = useMemo(() => {
    if (user?.role === 'emprunteur') {
      return [...EMPRUNTEUR_VISIBLE_TAB_NAMES];
    }
    return staffVisibleTabNames(user?.role === 'admin');
  }, [user?.role]);

  const currentRouteName = state.routes[state.index]?.name ?? '';

  const renderTab = useCallback(
    (routeName: string) => {
      const route = state.routes.find(r => r.name === routeName) as TabRoute | undefined;
      if (!route) return null;

      const { options } = descriptors[route.key];
      /** Surbrillance : l’onglet Menu reste « actif » sur IA, Consommables, etc. */
      const visualFocused =
        routeName === 'MenuHub'
          ? menuHubTabIsFocused(currentRouteName, user?.role)
          : currentRouteName === routeName;

      const activeColor = options.tabBarActiveTintColor ?? Colors.textPrimary;
      const inactiveColor = options.tabBarInactiveTintColor ?? Colors.tabBarInactive;
      const color = visualFocused ? activeColor : inactiveColor;

      const rawLabel =
        options.tabBarLabel !== undefined
          ? options.tabBarLabel
          : options.title !== undefined
            ? options.title
            : route.name;
      const label =
        typeof rawLabel === 'string'
          ? rawLabel
          : typeof rawLabel === 'function'
            ? String(route.name)
            : String(route.name);

      const icon = options.tabBarIcon?.({
        focused: visualFocused,
        color,
        size: visualFocused ? 26 : 24,
      });

      const onPress = (): void => {
        const e = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (e.defaultPrevented) return;

        if (routeName === 'MenuHub') {
          if (currentRouteName !== 'MenuHub') {
            navigation.navigate('MenuHub' as never);
          }
          return;
        }

        if (currentRouteName !== routeName) {
          navigation.navigate(route.name as never);
        }
      };

      const onLongPress = (): void => {
        navigation.emit({
          type: 'tabLongPress',
          target: route.key,
        });
      };

      return (
        <Pressable
          key={route.key}
          accessibilityRole="button"
          accessibilityState={visualFocused ? { selected: true } : {}}
          accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
          onPress={onPress}
          onLongPress={onLongPress}
          style={({ pressed }) => [
            styles.tabBtn,
            { opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <View style={styles.tabInner}>
            {icon}
            <Text
              numberOfLines={1}
              style={[
                Typography.tabLabel,
                styles.tabText,
                options.tabBarLabelStyle as object,
                { color },
              ]}
            >
              {label}
            </Text>
          </View>
        </Pressable>
      );
    },
    [currentRouteName, descriptors, navigation, state.routes, user?.role]
  );

  return (
    <View
      style={[
        styles.outer,
        {
          paddingBottom: bottomPad,
          minHeight: tabBarHeight,
        },
      ]}
    >
      <View style={styles.barInner}>
        <View style={styles.barRow}>{visibleNames.map(name => renderTab(name))}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  barInner: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: Colors.tabBar,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 0,
    overflow: 'hidden',
    ...Shadow.dock,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  tabBtn: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    marginTop: 2,
    marginBottom: 2,
    textAlign: 'center',
  },
});
