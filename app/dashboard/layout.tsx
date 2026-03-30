'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ThemeProvider } from './ThemeContext'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<string>('athlete')
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setEmail(session.user.email ?? '')
      const { data } = await supabase.from('profiles').select('is_admin, role').eq('id', session.user.id).single()
      if (data?.is_admin) setIsAdmin(true)
      if (data?.role) setRole(data.role)
    })
  }, [])

  if (!mounted) return (
    <div style={{ height: '100dvh' }} className="flex bg-[var(--bg-base)] items-center justify-center">
      <p className="text-gray-600 text-sm">Chargement...</p>
    </div>
  )

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '⌂' },
    ...(role === 'coach' ? [
      { href: '/dashboard/coach', label: 'Mes élèves', icon: '👥' },
      { href: '/dashboard/coach/programs', label: 'Programmes', icon: '📋' },
    ] : [
      { href: '/dashboard/athlete', label: 'Mon programme', icon: '🏋️' },
      { href: '/dashboard/athlete/progress', label: 'Progression sport', icon: '📈' },
      { href: '/dashboard/athlete/history', label: 'Séances', icon: '🗓' },
    ]),
    { href: '/dashboard/add', label: 'Ajouter', icon: '+' },
    { href: '/dashboard/scan', label: 'Scanner', icon: '▦' },
    { href: '/dashboard/history', label: 'Historique', icon: '↺' },
    { href: '/dashboard/progress', label: 'Stats nutri', icon: '↗' },
    { href: '/dashboard/week', label: 'Semaine', icon: '◫' },
    { href: '/dashboard/recipes', label: 'Recettes', icon: '◧' },
    { href: '/dashboard/plans', label: 'Plans', icon: '≡' },
    { href: '/dashboard/challenges', label: 'Défis', icon: '◈' },
    { href: '/dashboard/profile', label: 'Profil', icon: '◉' },
    ...(isAdmin ? [{ href: '/dashboard/admin', label: 'Admin', icon: '🛡️' }] : []),
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ height: '100dvh' }} className="flex bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden">

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-52 min-w-52 bg-[var(--bg-surface)] border-r border-[var(--border)] flex-col">
        <div className="p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-input)] border border-yellow-600/30 flex items-center justify-center text-sm text-yellow-500">+</div>
            <span className="font-serif text-lg text-[var(--text-primary)]">CalTrack</span>
          </div>
        </div>
        <nav className="flex-1 p-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest px-2 mb-2">Principal</p>
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 transition-colors
                ${pathname === item.href
                  ? 'bg-blue-600/15 text-blue-300 border border-blue-500/20'
                  : 'text-gray-400 hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'}`}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--border)]">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{email}</p>
          </div>
          <button onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10">
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* MAIN MOBILE */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* TOPBAR MOBILE — fixe en haut */}
        <div className="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] border-b border-[var(--border)]">
          <span className="font-serif text-lg text-[var(--text-primary)]">CalTrack</span>
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 flex flex-col items-center justify-center gap-1.5">
            <span className={`block w-5 h-0.5 bg-[var(--text-primary)] transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}/>
            <span className={`block w-5 h-0.5 bg-[var(--text-primary)] transition-all ${menuOpen ? 'opacity-0' : ''}`}/>
            <span className={`block w-5 h-0.5 bg-[var(--text-primary)] transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}/>
          </button>
        </div>

        {/* MENU MOBILE OVERLAY */}
        {menuOpen && (
          <div className="md:hidden absolute inset-0 z-50 bg-black/85 flex flex-col pt-16 px-6">
            <button onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-400 text-2xl">✕</button>
            <nav className="space-y-2 mt-4">
              {navItems.map(item => (
                <Link key={item.href} href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-4 px-4 py-4 rounded-xl text-base transition-colors
                    ${pathname === item.href
                      ? 'bg-blue-600/15 text-blue-300 border border-blue-500/20'
                      : 'text-gray-300 hover:bg-white/5'}`}>
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto pb-8">
              <p className="text-xs text-gray-600 mb-3 px-4">{email}</p>
              <button onClick={handleLogout}
                className="w-full px-4 py-3 rounded-xl text-sm text-red-400 bg-red-500/10 border border-red-500/20">
                Se déconnecter
              </button>
            </div>
          </div>
        )}

        {/* CONTENU — scrollable entre les deux barres */}
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </main>

        {/* BOTTOM NAV MOBILE — fixe en bas */}
        <nav className="md:hidden flex-shrink-0 flex border-t border-[var(--border)] bg-[var(--bg-surface)]">
          {navItems.slice(0, 5).map(item => (
            <Link key={item.href} href={item.href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs transition-colors
                ${pathname === item.href ? 'text-blue-300' : 'text-gray-500'}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DashboardShell>{children}</DashboardShell>
    </ThemeProvider>
  )
}
