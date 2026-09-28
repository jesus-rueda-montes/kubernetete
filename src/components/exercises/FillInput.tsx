import { useState } from 'react'
import { getCliSpec } from '../../content/loader'
import type { CliSpec, FillExercise } from '../../content/schema'
import { commonPrefix, complete, type Candidate } from '../../engine/cli'
import { splitTemplate, type GradeResult } from '../../engine/grade'

interface Props {
  ex: FillExercise
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  result?: GradeResult
  onSubmit?: () => void
}

type Part = ReturnType<typeof splitTemplate>[number]

/** Texto de la línea hasta el hueco indicado, con los huecos anteriores rellenos. */
function lineUpTo(parts: Part[], index: number, values: Record<string, string>): string {
  return parts
    .slice(0, index)
    .map((p) => ('text' in p ? p.text : (values[p.blank] ?? '')))
    .join('')
}

/**
 * Completa un hueco con Tab usando la especificación de la CLI. El hueco puede
 * ser solo parte de un token (p. ej. el nombre en "--{{flag}}=..."), así que
 * se recorta del candidato lo que ya está escrito antes del hueco.
 */
function completeBlank(spec: CliSpec, before: string, current: string): { value: string; options: Candidate[] } {
  const c = complete(spec, before + current)
  const inToken = before.slice(c.start) // parte del token que precede al hueco
  const options = c.candidates
    .filter((x) => x.value.startsWith(inToken))
    .map((x) => ({ ...x, value: x.value.slice(inToken.length).replace(/=.*$/, '') }))
  const unique = [...new Map(options.map((o) => [o.value, o])).values()]
  if (unique.length === 1) return { value: unique[0].value, options: [] }
  const prefix = commonPrefix(unique.map((o) => o.value))
  return { value: prefix.length > current.length ? prefix : current, options: unique }
}

export function FillInput({ ex, values, onChange, result, onSubmit }: Props) {
  const parts = splitTemplate(ex.template)
  const cli = ex.template.trim().split(/\s+/)[0]
  const spec = ex.language === 'shell' ? getCliSpec(cli) : undefined
  const [options, setOptions] = useState<{ blank: string; list: Candidate[] } | null>(null)

  return (
    <div>
      <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-4 font-mono text-sm leading-9 whitespace-pre-wrap">
        {parts.map((p, i) => {
          if ('text' in p) return <span key={i}>{p.text}</span>
          const value = values[p.blank] ?? ''
          const ok = result?.blanks?.[p.blank]
          const tone =
            ok === undefined
              ? 'border-sky-700 focus:border-sky-400'
              : ok
                ? 'border-emerald-500 text-emerald-200'
                : 'border-red-500 text-red-200'
          return (
            <input
              key={i}
              aria-label={`hueco ${p.blank}`}
              value={value}
              disabled={!!result}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              size={Math.max(6, value.length + 1)}
              onChange={(e) => {
                setOptions(null)
                onChange({ ...values, [p.blank]: e.target.value })
              }}
              onBlur={() => setOptions(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmit?.()
                if (e.key === 'Tab' && spec && !e.shiftKey) {
                  const r = completeBlank(spec, lineUpTo(parts, i, values), value)
                  // Si no hay nada que completar, Tab mueve al siguiente hueco como siempre.
                  if (r.value === value && r.options.length === 0) return
                  e.preventDefault()
                  if (r.value !== value) onChange({ ...values, [p.blank]: r.value })
                  setOptions(r.options.length ? { blank: p.blank, list: r.options } : null)
                }
              }}
              className={`mx-1 rounded border-b-2 bg-slate-950 px-1.5 py-0.5 font-mono outline-none ${tone}`}
            />
          )
        })}
      </pre>
      {options && (
        <ul className="mt-2 rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-xs">
          {options.list.map((o) => (
            <li key={o.value} className="flex gap-3 px-1 py-0.5">
              <span className="text-sky-300">{o.value}</span>
              {o.description && <span className="font-sans text-slate-500">{o.description}</span>}
            </li>
          ))}
        </ul>
      )}
      {spec && !result && <p className="mt-2 text-xs text-slate-500">Pulsa Tab dentro de un hueco para autocompletar.</p>}
    </div>
  )
}
