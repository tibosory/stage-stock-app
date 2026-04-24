import React from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadow } from '../theme/colors';
import ScannerScreen from '../screens/ScannerScreen';
import PretsScreen from '../screens/PretsScreen';
import ParamsScreen from '../screens/ParamsScreen';
import AlertesScreen from '../screens/AlertesScreen';
import ImportExportScreen from '../screens/ImportExportScreen';
import AssistantScreen from '../screens/AssistantScreen';
import EmprunteurCompteScreen from '../screens/EmprunteurCompteScreen';
import PrintHubScreen from '../screens/PrintHubScreen';
import NoticeUtilisateurScreen from '../screens/NoticeUtilisateurScreen';
import NetworkScreen from '../screens/NetworkScreen';
import ConsommablesScreen from '../screens/ConsommablesScreen';
import {
  StockStackNavigator,
  VgpStackNavigator,
} from './screenStacks';
import { goActivityHome } from './goActivityHome';
import { useNavigation } from '@react-navigation/native';
import {
  ScanIcon,
  BoxIcon,
  CartIcon,
  ClipboardIcon,
  GearIcon,
  BellIcon,
  SparklesIcon,
  BookIcon,
  NetworkIcon,
} from '../components/Icons';
import { isConsumerApp } from '../config/appMode';

const Tab = createBottomTabNavigator();

const WS_TAB_BAR = {
  headerShown: false as const,
  tabBarStyle: {
    backgroundColor: Colors.tabBar,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    minHeight: Platform.OS === 'android' ? 56 : 52,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabBarActiveTintColor: Colors.green,
  tabBarInactiveTintColor: Colors.tabBarInactive,
  tabBarLabelStyle: { fontSize: 12, fontWeight: '600' as const },
};

function WorkspaceHomeFab() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  /** Haut gauche : ne recouvre plus la zone de défilement des listes. */
  const top = Math.max(insets.top, 8) + 10;
  return (
    <Pressable
      onPress={() => goActivityHome(navigation)}
      style={({ pressed }) => [
        styles.homeFab,
        { top, left: 12, bottom: undefined, opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Retour au menu d'accueil des activités"
    >
      <Text style={styles.homeFabIcon} accessibilityElementsHidden>
        ⌂
      </Text>
    </Pressable>
  );
}

function workspaceTabIcon(
  routeName: string,
  color: string,
  size: number
): React.ReactNode {
  const s = Math.max(size, 22);
  switch (routeName) {
    case 'WsStock':
    case 'WsConso':
      return <BoxIcon size={s} color={color} />;
    case 'WsScan':
      return <ScanIcon size={s} color={color} />;
    case 'WsPret':
      return <ClipboardIcon size={s} color={color} />;
    case 'WsVgp':
      return <ClipboardIcon size={s} color={color} />;
    case 'WsParams':
      return <GearIcon size={s} color={color} />;
    case 'WsAlertes':
      return <BellIcon size={s} color={color} />;
    case 'WsImport':
      return <ClipboardIcon size={s} color={color} />;
    case 'WsPrint':
      return <ClipboardIcon size={s} color={color} />;
    case 'WsAssistant':
      return <SparklesIcon size={s} color={color} />;
    case 'WsNotice':
      return <BookIcon size={s} color={color} />;
    case 'WsReseau':
      return <NetworkIcon size={s} color={color} />;
    case 'WsCompte':
      return <ClipboardIcon size={s} color={color} />;
    default:
      return <ScanIcon size={s} color={color} />;
  }
}

function shell(Ws: React.ComponentType) {
  return function WorkspaceWithFab() {
    return (
      <View style={styles.shell} pointerEvents="box-none">
        <WorkspaceHomeFab />
        <Ws />
      </View>
    );
  };
}

function StockWorkspaceTabs() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsStock"
        component={StockStackNavigator}
        options={{
          tabBarLabel: 'Stock',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsStock', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function ConsoWorkspaceTabs() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsConso"
        component={ConsommablesScreen}
        options={{
          tabBarLabel: 'Consom.',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsConso', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function PretWorkspaceTabs() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsPret"
        component={PretsScreen}
        options={{
          tabBarLabel: 'Prêts',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsPret', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function VgpWorkspaceTabs() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsVgp"
        component={VgpStackNavigator}
        options={{
          tabBarLabel: 'Contrôle',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsVgp', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function ParamsWithScan() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsParamsMain"
        component={ParamsScreen}
        options={{
          tabBarLabel: 'Paramètres',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsParams', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function AlertesWithScan() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsAlertesMain"
        component={AlertesScreen}
        options={{
          tabBarLabel: 'Alertes',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsAlertes', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function ImportWithScan() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsImportMain"
        component={ImportExportScreen}
        options={{
          tabBarLabel: 'Import / export',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsImport', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function PrintWithScan() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsPrintMain"
        component={PrintHubScreen}
        options={{
          tabBarLabel: 'Impression',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsPrint', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function AssistantWithScan() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsIaMain"
        component={AssistantScreen}
        options={{
          tabBarLabel: 'IA',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsAssistant', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function NoticeWithScan() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsNoticeMain"
        component={NoticeUtilisateurScreen}
        options={{
          tabBarLabel: 'Notice',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsNotice', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function ReseauWorkspaceTabs() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsReseau"
        component={NetworkScreen}
        options={{
          tabBarLabel: isConsumerApp() ? 'Lien' : 'Réseau',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsReseau', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

function CompteEmprunteurWithScan() {
  return (
    <Tab.Navigator screenOptions={WS_TAB_BAR}>
      <Tab.Screen
        name="WsCompte"
        component={EmprunteurCompteScreen}
        options={{
          tabBarLabel: 'Compte',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsCompte', color, size),
        }}
      />
      <Tab.Screen
        name="WsScan"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => workspaceTabIcon('WsScan', color, size),
        }}
      />
    </Tab.Navigator>
  );
}

export const WorkspaceStock = shell(StockWorkspaceTabs);
export const WorkspaceConsommable = shell(ConsoWorkspaceTabs);
export const WorkspacePret = shell(PretWorkspaceTabs);
export const WorkspaceControle = shell(VgpWorkspaceTabs);
export const WorkspaceParams = shell(ParamsWithScan);
export const WorkspaceAlertes = shell(AlertesWithScan);
export const WorkspaceImportExport = shell(ImportWithScan);
export const WorkspaceImpression = shell(PrintWithScan);
export const WorkspaceAssistant = shell(AssistantWithScan);
export const WorkspaceNotice = shell(NoticeWithScan);
export const WorkspaceReseau = shell(ReseauWorkspaceTabs);
export const WorkspaceCompteEmprunteur = shell(CompteEmprunteurWithScan);

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: Colors.bg },
  homeFab: {
    position: 'absolute',
    zIndex: 200,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.bgElevated,
    borderWidth: 2,
    borderColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.dock,
  },
  homeFabIcon: {
    fontSize: 22,
    color: Colors.white,
    fontWeight: '700',
  },
});
