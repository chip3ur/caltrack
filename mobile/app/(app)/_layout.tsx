import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { useColors } from '../../lib/theme'

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const c = useColors()
  return <Text style={{ fontSize: 18, color: focused ? c.accentText : c.textDim }}>{label}</Text>
}

export default function AppLayout() {
  const c = useColors()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.tabBar,
          borderTopColor: c.tabBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: c.accentText,
        tabBarInactiveTintColor: c.textDim,
        tabBarLabelStyle: { fontSize: 10 },
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
        name="recipes"
        options={{
          title: 'Recettes',
          tabBarIcon: ({ focused }) => <TabIcon label="◧" focused={focused} />,
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
