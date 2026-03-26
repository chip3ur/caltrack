'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState('')
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else setEmail(session.user.email ?? '')
    })
  }, [])

  if (!mounted) return (
    <div className="flex h-screen bg-[#0A0A0F] items-center justify-center">
      <p className="text-gray-600 text-sm">Chargement...</p>
    </div>
  )

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '⌂' },
    { href: '/dashboard/add', label: 'Ajouter', icon: '+' },
    { href: '/dashboard/scan', label: 'Scanner', icon: '▦' },
    { href: '/dashboard/history', label: 'Historique', icon: '↺' },
    { href: '/dashboard/progress', label: 'Progression', icon: '↗' },
    { href: '/dashboard/profile', label: 'Profil', icon: '◉' },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-[#0A0A0F] text-white overflow-hidden">

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-52 min-w-52 bg-[#111118] border-r border-[#22222E] flex-col">
        <div className="p-5 border-b border-[#22222E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1E1E28] border border-yellow-600/30 flex items-center justify-center text-sm text-yellow-500">+</div>
            <span className="font-serif text-lg">CalTrack</span>
          </div>
        </div>
        <nav className="flex-1 p-3">
          <p className="text-xs text-gray-600 uppercase tracking-widest px-2 mb-2">Principal</p>
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 transition-colors
                ${pathname === item.href
                  ? 'bg-blue-600/15 text-blue-300 border border-blue-500/20'
                  : 'text-gray-400 hover:bg-[#18181F] hover:text-white'}`}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-[#22222E]">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-white truncate">{email}</p>
          </div>
          <button onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10">
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOPBAR MOBILE */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#111118] border-b border-[#22222E]">
          <span className="font-serif text-lg">CalTrack</span>
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 flex flex-col items-center justify-center gap-1.5">
            <span className={`block w-5 h-0.5 bg-white transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}/>
            <span className={`block w-5 h-0.5 bg-white transition-all ${menuOpen ? 'opacity-0' : ''}`}/>
            <span className={`block w-5 h-0.5 bg-white transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}/>
          </button>
        </div>

        {/* MENU MOBILE OVERLAY */}
        {menuOpen && (
          <div className="md:hidden absolute inset-0 z-50 bg-[#0A0A0F]/95 flex flex-col pt-16 px-6">
            <button onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-400 text-2xl">✕</button>
            <nav className="space-y-2 mt-4">
              {navItems.map(item => (
                <Link key={item.href} href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-4 px-4 py-4 rounded-xl text-base transition-colors
                    ${pathname === item.href
                      ? 'bg-blue-600/15 text-blue-300 border border-blue-500/20'
                      : 'text-gray-300 hover:bg-[#18181F]'}`}>
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

        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>

        {/* BOTTOM NAV MOBILE */}
        <nav className="md:hidden flex border-t border-[#22222E] bg-[#111118]">
          {navItems.slice(0, 5).map(item => (
            <Link key={item.href} href={item.href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs transition-colors
                ${pathname === item.href ? 'text-blue-300' : 'text-gray-600'}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}