import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import type { IconName, RootTabParamList } from '../types';
import HomeScreen from '../screens/HomeScreen';
import AssistantScreen from '../screens/AssistantScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import GoalsScreen from '../screens/GoalsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} options={{ title: 'Início', tabBarIcon: icon('home-outline') }} />
      <Tab.Screen name="Assistente" component={AssistantScreen} options={{ title: 'Assistente', tabBarIcon: icon('chatbubble-ellipses-outline') }} />
      <Tab.Screen name="Lancamentos" component={TransactionsScreen} options={{ title: 'Lançamentos', tabBarIcon: icon('swap-vertical-outline') }} />
      <Tab.Screen name="Relatorios" component={ReportsScreen} options={{ title: 'Relatórios', tabBarIcon: icon('pie-chart-outline') }} />
      <Tab.Screen name="Metas" component={GoalsScreen} options={{ title: 'Metas', tabBarIcon: icon('flag-outline') }} />
      <Tab.Screen name="Perfil" component={ProfileScreen} options={{ title: 'Perfil', tabBarIcon: icon('person-outline') }} />
    </Tab.Navigator>
  );
}

function icon(name: IconName) {
  return ({ color, size }: { color: string; size: number }): React.JSX.Element => (
    <Ionicons name={name} size={size} color={color} />
  );
}
