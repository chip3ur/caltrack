import { Tabs } from 'expo-router'
import { StyleSheet, Text } from 'react-native'

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 18, color: focused ? '#93c5fd' : '#4B4B5A' }}>{label}</Text>
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: s.tabBar,
        tabBarActiveTintColor: '#93c5fd',
        tabBarInactiveTintColor: '#4B4B5A',
        tabBarLabelStyle: s.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="⌂" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Ajouter',
          tabBarIcon: ({ focused }) => <TabIcon label="+" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ focused }) => <TabIcon label="▦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarIcon: ({ focused }) => <TabIcon label="↺" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progression',
          tabBarIcon: ({ focused }) => <TabIcon label="↗" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon label="◉" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

const s = StyleSheet.create({
  tabBar: {
    backgroundColor: '#111118',
    borderTopColor: '#22222E',
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
  },
  label: {
    fontSize: 10,
  },
})
