import { useState } from 'react'
import { clamp } from '@/shared/lib/units'

type NumberFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  slider?: boolean
  disabled?: boolean
  onChange: (value: number) => void
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  slider = true,
  disabled = false,
  onChange,
}: NumberFieldProps) {
  // Пока поле редактируют, значение живёт в draft: иначе промежуточный ввод
  // («», «1» вместо «1200») сразу уезжал бы в модель и зажимался по границам.
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string) => {
    const parsed = Number(raw)
    if (!disabled && raw.trim() !== '' && Number.isFinite(parsed)) onChange(clamp(parsed, min, max))
    setDraft(null)
  }

  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-slate-600">
        {label}
        <span className="text-slate-400">мм</span>
      </span>
      <input
        type="number"
        disabled={disabled}
        value={draft ?? String(value)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setDraft(null)
        }}
        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      />
      {slider && (
        <input
          type="range"
          disabled={disabled}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            setDraft(null)
            onChange(Number(e.target.value))
          }}
          className="mt-1.5 w-full accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        />
      )}
    </label>
  )
}
