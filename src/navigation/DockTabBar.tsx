import React, { useCallback } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { isConsumerApp } from '../config/appMode';

/**
 * Largeur mini par onglet (aligné sur tabBarItemStyle max ~140 / labels FR).
 */
const TAB_MIN_PX = 82;

/** Même logique que App.tsx MainTabs — barre du bas lisible sur Samsung / nav 3 boutons */
const ANDROID_BOTTOM_NAV_MIN_DP = 52;

/**
 * Barre d’onglets en défilement horizontal.
 *
 * Ne pas imbriquer le `BottomTabBar` du router dans un `ScrollView` RN : sur Android
 * (ex. Samsung One UI) le layout interne utilise souvent toute la largeur écran et le
 * scroll ne prend pas. Ici chaque onglet est un bouton explicite (`flexShrink: 0`) dans
 * un `ScrollView` de react-native-gesture-handler.
 */
export function DockTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const bottomPad =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, ANDROID_BOTTOM_NAV_MIN_DP)
      : Math.max(insets.bottom, 12);
  const tabBarHeight = 60 + bottomPad;

  const openOverflowMenu = useCallback(() => {
    const netLabel = isConsumerApp() ? 'Connexion (serveur)' : 'Réseau';
    Alert.alert(
      'Menu rapide',
      user?.nom
        ? `Connecté : ${user.nom}\nParamètres, serveur ou autre compte — sans défiler les onglets.`
        : 'Paramètres, serveur ou déconnexion.',
      [
        {
          text: 'Paramètres',
          onPress: () => navigation.navigate('Params' as never),
        },
        {
          text: netLabel,
          onPress: () => navigation.navigate('Réseau' as never),
        },
        {
          text: 'Notice',
          onPress: () => navigation.navigate('Notice' as never),
        },
        {
          text: 'Se déconnecter…',
          onPress: () => {
            Alert.alert(
              'Déconnexion',
              'Changer d’utilisateur ou de compte : vous reverrez l’écran de connexion.',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Se déconnecter', style: 'destructive', onPress: () => void logout() },
              ]
            );
          },
        },
        { text: 'Fermer', style: 'cancel' },
      ]
    );
  }, [logout, navigation, user?.nom]);

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
      <View style={styles.barRow}>
        <ScrollView
          horizontal
          scrollEnabled
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={Platform.OS === 'android'}
          bounces={Platform.OS === 'ios'}
          alwaysBounceHorizontal={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews={false}
        >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const activeColor = options.tabBarActiveTintColor ?? Colors.textPrimary;
          const inactiveColor = options.tabBarInactiveTintColor ?? Colors.tabBarInactive;
          const color = isFocused ? activeColor : inactiveColor;

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
            focused: isFocused,
            color,
            size: isFocused ? 26 : 24,
          });

          const onPress = (): void => {
            const e = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !e.defaultPrevented) {
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
              accessibilityState={isFocused ? { selected: true } : {}}
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
        })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menu rapide, déconnexion"
          onPress={openOverflowMenu}
          style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.moreBtnText} allowFontScaling={false}>
            ⋮
          </Text>
          <Text style={styles.moreBtnHint}>Menu</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.tabBar,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  scroll: {
    flex: 1,
    minWidth: 0,
  },
  moreBtn: {
    flexShrink: 0,
    width: 44,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.separator,
  },
  moreBtnText: {
    color: Colors.textSecondary,
    fontSize: 20,
    lineHeight: 22,
    marginTop: -2,
  },
  moreBtnHint: {
    color: Colors.tabBarInactive,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    /** Indispensable sur certains Android : sans ça le contenu peut s’étirer à la largeur du ScrollView et bloquer le scroll. */
    flexGrow: 0,
  },
  tabBtn: {
    flexShrink: 0,
    minWidth: TAB_MIN_PX,
    maxWidth: 140,
    paddingVertical: 4,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 2,
    marginBottom: 2,
    textAlign: 'center',
  },
});
