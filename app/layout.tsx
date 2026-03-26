import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CalTrack — nutrition · performance · résultats',
  description: 'Suivez vos calories intelligemment avec CalTrack',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}