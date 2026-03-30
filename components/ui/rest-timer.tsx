'use client'
import { useEffect, useRef, useState } from 'react'

interface RestTimerProps {
  seconds: number
  onComplete?: () => void
  onDismiss?: () => void
}

export function RestTimer({ seconds, onComplete, onDismiss }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  const [active, setActive] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!active) return
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!)
          setActive(false)
          onComplete?.()
          // Vibration si dispo
          if (navigator.vibrate) navigator.vibrate([200, 100, 200])
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [active])

  const pct = ((seconds - remaining) / seconds) * 100
  const radius = 36
  const circ = 2 * Math.PI * radius
  const dash = circ - (pct / 100) * circ

  const color = remaining > seconds * 0.4 ? '#22c55e' : remaining > seconds * 0.2 ? '#f59e0b' : '#ef4444'

  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50 flex flex-col items-center gap-2">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-3 min-w-[140px]">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Repos</p>

        {/* Cercle SVG */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
            <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="4"
              strokeDasharray={circ} strokeDashoffset={dash}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
          </svg>
          <span className="text-2xl font-bold tabular-nums" style={{ color }}>
            {remaining}
          </span>
        </div>

        <p className="text-xs text-gray-400">
          {remaining === 0 ? '💪 C\'est parti !' : 'secondes restantes'}
        </p>

        <div className="flex gap-2 w-full">
          <button onClick={() => setRemaining(r => Math.min(r + 15, seconds + 30))}
            className="flex-1 py-1.5 rounded-lg bg-[var(--bg-input)] text-xs text-gray-400 hover:text-[var(--text-primary)] transition-colors">
            +15s
          </button>
          <button onClick={() => { clearInterval(intervalRef.current!); onDismiss?.() }}
            className="flex-1 py-1.5 rounded-lg bg-[var(--bg-input)] text-xs text-gray-400 hover:text-red-400 transition-colors">
            Passer
          </button>
        </div>
      </div>
    </div>
  )
}
