import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1e3a5f',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
        },
        headerStyle: {
          backgroundColor: '#1e3a5f',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendario',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clienti"
        options={{
          title: 'Clienti',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="altro"
        options={{
          title: 'Altro',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
