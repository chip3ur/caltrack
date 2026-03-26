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

  const LogoSVG = ({ size = 32 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#1E1E28" stroke="#C9A84C" strokeWidth="0.5" opacity="0.8"/>
      <ellipse cx="16" cy="8" rx="9" ry="2" fill="#C9A84C"/>
      <ellipse cx="16" cy="8" rx="5" ry="1.5" fill="#E8C96A"/>
      <ellipse cx="16" cy="14" rx="6" ry="5.5" fill="#F4C17A"/>
      <path d="M10 12 Q11 7 16 7.5 Q21 7 22 12" fill="#1A0A00"/>
      <circle cx="13" cy="12.5" r="1.8" fill="white"/>
      <circle cx="19" cy="12.5" r="1.8" fill="white"/>
      <circle cx="13" cy="13" r="1" fill="#1A0A00"/>
      <circle cx="19" cy="13" r="1" fill="#1A0A00"/>
      <path d="M12 17 Q16 22 20 17" fill="#C0392B"/>
      <path d="M12 17 Q16 20 20 17" fill="#E74C3C"/>
      <path d="M10 19 Q7 21 8 25 L24 25 Q25 21 22 19 Q19 21 16 21 Q13 21 10 19Z" fill="#378ADD"/>
      <circle cx="5" cy="23" r="3" fill="#C0392B"/>
      <circle cx="27" cy="23" r="2.5" fill="#F39C12"/>
    </svg>
  )

  return (
    <div className="flex h-screen bg-[#0A0A0F] text-white overflow-hidden">

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-52 min-w-52 bg-[#111118] border-r border-[#22222E] flex-col">
        <div className="p-5 border-b border-[#22222E]">
          <div className="flex items-center gap-3">
            <LogoSVG size={32} />
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
          <div className="flex items-center gap-2">
            <LogoSVG size={28} />
            <span className="font-serif text-lg">CalTrack</span>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 flex flex-col items-center justify-center gap-1.5">
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}/>
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`}/>
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}/>
          </button>
        </div>

        {/* MENU MOBILE OVERLAY */}
        {menuOpen && (
          <div className="md:hidden absolute inset-0 z-50 bg-[#0A0A0F]/95 flex flex-col pt-16 px-6">
            <button onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-400 text-2xl">✕</button>
            <div className="flex items-center gap-3 mb-8">
              <LogoSVG size={40} />
              <div>
                <p className="font-serif text-xl">CalTrack</p>
                <p className="text-xs text-gray-500">{email}</p>
              </div>
            </div>
            <nav className="space-y-2">
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