'use client'
import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine
} from 'recharts'

interface DataPoint {
  session_date: string
  max_weight: number
  total_volume: number
  avg_rpe: number
}

interface ProgressionChartProps {
  data: DataPoint[]
  metric?: 'weight' | 'volume' | 'rpe'
  exerciseName?: string
}

const METRICS = {
  weight: { key: 'max_weight', label: 'Charge max (kg)', color: '#3b82f6' },
  volume: { key: 'total_volume', label: 'Volume total (kg)', color: '#8b5cf6' },
  rpe: { key: 'avg_rpe', label: 'RPE moyen', color: '#f59e0b' },
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{new Date(label).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.value?.toFixed(1)} {p.name}
        </p>
      ))}
    </div>
  )
}

export function ProgressionChart({ data, metric = 'weight', exerciseName }: ProgressionChartProps) {
  const [activeMetric, setActiveMetric] = useState(metric)
  const { key, label, color } = METRICS[activeMetric]

  const allTimePR = data.reduce((best, d) => {
    const v = (d as any)[key] ?? 0
    return v > best.value ? { value: v, date: d.session_date } : best
  }, { value: 0, date: '' })

  const chartData = data.map(d => ({
    date: d.session_date,
    [label]: parseFloat(((d as any)[key] ?? 0).toFixed(1)),
  }))

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
      {exerciseName && (
        <h3 className="font-semibold text-[var(--text-primary)] mb-1">{exerciseName}</h3>
      )}

      {/* Sélecteur métrique */}
      <div className="flex gap-2 mb-4">
        {(Object.entries(METRICS) as [keyof typeof METRICS, typeof METRICS[keyof typeof METRICS]][]).map(([k, m]) => (
          <button key={k} onClick={() => setActiveMetric(k)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeMetric === k
                ? 'text-white'
                : 'bg-[var(--bg-input)] text-gray-500 hover:text-gray-300'
            }`}
            style={activeMetric === k ? { backgroundColor: m.color } : {}}>
            {k === 'weight' ? 'Charge' : k === 'volume' ? 'Volume' : 'RPE'}
          </button>
        ))}
      </div>

      {data.length < 2 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-500">
          Pas encore assez de données (min. 2 séances)
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date"
              tickFormatter={d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              tick={{ fontSize: 10, fill: 'var(--text-muted, #6b7280)' }}
              tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted, #6b7280)' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {allTimePR.value > 0 && (
              <ReferenceLine y={allTimePR.value} stroke={color} strokeDasharray="4 2" opacity={0.5} />
            )}
            <Line type="monotone" dataKey={label} stroke={color} strokeWidth={2.5}
              dot={{ r: 4, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: color }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-0.5">Séances</div>
          <div className="font-bold text-sm text-[var(--text-primary)]">{data.length}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-0.5">Record</div>
          <div className="font-bold text-sm" style={{ color }}>{allTimePR.value.toFixed(1)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-0.5">Progression</div>
          <div className="font-bold text-sm" style={{ color: data.length >= 2 && (data[data.length-1] as any)[key] > (data[0] as any)[key] ? '#22c55e' : '#ef4444' }}>
            {data.length >= 2
              ? `${((data[data.length-1] as any)[key] > (data[0] as any)[key] ? '+' : '')}${(((data[data.length-1] as any)[key] - (data[0] as any)[key]) / (data[0] as any)[key] * 100).toFixed(0)}%`
              : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

