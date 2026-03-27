import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemeMode = 'dark' | 'light' | 'creme'

// Noir et doré
export const darkColors = {
  bg: '#0A0A08',
  card: '#131310',
  cardAlt: '#1C1C18',
  border: '#2A2A22',
  borderAlt: '#363630',
  text: '#FFFFFF',
  textSub: '#E8D5A3',
  textMuted: '#B8952A',
  textDim: '#7A6420',
  accent: '#D4AF37',
  accentLight: 'rgba(212,175,55,0.12)',
  accentBorder: 'rgba(212,175,55,0.35)',
  accentText: '#F0C040',
  placeholder: '#5C4E20',
  inputBg: '#1C1C18',
  tabBar: '#131310',
  tabBorder: '#2A2A22',
}

// Blanc et bleu
export const lightColors = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  cardAlt: '#F0F0F5',
  border: '#E5E7EB',
  borderAlt: '#D1D5DB',
  text: '#111827',
  textSub: '#374151',
  textMuted: '#6B7280',
  textDim: '#9CA3AF',
  accent: '#2563eb',
  accentLight: 'rgba(37,99,235,0.1)',
  accentBorder: 'rgba(37,99,235,0.3)',
  accentText: '#1D4ED8',
  placeholder: '#9CA3AF',
  inputBg: '#FFFFFF',
  tabBar: '#FFFFFF',
  tabBorder: '#E5E7EB',
}

// Crème et brun chaud
export const cremeColors = {
  bg: '#FAF6ED',
  card: '#FFF9F0',
  cardAlt: '#F0E8D8',
  border: '#E2D4BC',
  borderAlt: '#CFC0A0',
  text: '#1C1410',
  textSub: '#3D2E1E',
  textMuted: '#7A6248',
  textDim: '#A08868',
  accent: '#7C5C2C',
  accentLight: 'rgba(124,92,44,0.1)',
  accentBorder: 'rgba(124,92,44,0.3)',
  accentText: '#5C3C14',
  placeholder: '#A08868',
  inputBg: '#FFFFFF',
  tabBar: '#FFF9F0',
  tabBorder: '#E2D4BC',
}

export type Colors = typeof darkColors

const KEY = 'theme_mode'

type Ctx = { theme: ThemeMode; setTheme: (t: ThemeMode) => void; colors: Colors }
const ThemeContext = createContext<Ctx>({ theme: 'dark', setTheme: () => {}, colors: darkColors })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark')

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v) setThemeState(v as ThemeMode)
    })
  }, [])

  function setTheme(t: ThemeMode) {
    setThemeState(t)
    AsyncStorage.setItem(KEY, t)
  }

  const colors = theme === 'light' ? lightColors : theme === 'creme' ? cremeColors : darkColors

  return <ThemeContext.Provider value={{ theme, setTheme, colors }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
export const useColors = () => useContext(ThemeContext).colors
