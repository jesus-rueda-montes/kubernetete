import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { CliSpec } from '../content/schema'
import { acceptCandidate, applyCompletion, complete } from '../engine/cli'

export interface TermLine {
  kind: 'cmd' | 'out' | 'err'
  text: string
}

interface Props {
  spec?: CliSpec
  value: string
  onChange: (v: string) => void
  /** Enter. Si no se pasa, Enter no hace nada (p. ej. durante el examen). */
  onSubmit?: () => void
  /** Líneas ya ejecutadas que se muestran encima del prompt. */
  lines?: TermLine[]
  disabled?: boolean
}

/**
 * Terminal simulada: Tab autocompleta (subcomandos, recursos, flags y valores),
 * al escribir "-" aparece la lista de flags con su descripción, ↑/↓ recorre la
 * lista o el historial y Esc la cierra.
 */
export function Terminal({ spec, value, onChange, onSubmit, lines = [], disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const history = useRef<string[]>([])
  const [historyIdx, setHistoryIdx] = useState<number | null>(null)
  const [listRequested, setListRequested] = useState(false)
  const [selected, setSelected] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  const completion = useMemo(() => (spec && !disabled ? complete(spec, value) : null), [spec, value, disabled])
  const candidates = completion?.candidates ?? []
  const exactOnly = candidates.length === 1 && candidates[0].value === completion?.partial
  const listOpen =
    candidates.length > 0 && !exactOnly && !dismissed && (listRequested || !!completion?.partial.startsWith('-'))

  const change = (v: string) => {
    onChange(v)
    setListRequested(false)
    setDismissed(false)
    setSelected(0)
    setHistoryIdx(null)
  }

  const tab = () => {
    if (!completion) return
    // Como en bash: Tab completa lo que es inequívoco; si no avanza, muestra
    // la lista; con la lista abierta, Tab elige la opción resaltada.
    if (listOpen && candidates[selected] && (listRequested || selected > 0)) {
      change(acceptCandidate(value, completion, candidates[selected].value))
    } else {
      const r = applyCompletion(value, completion)
      if (r.changed) change(r.line)
      else {
        setListRequested(true)
        setDismissed(false)
      }
    }
    inputRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      tab()
    } else if (e.key === 'Escape') {
      setListRequested(false)
      setDismissed(true)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const dir = e.key === 'ArrowDown' ? 1 : -1
      if (listOpen) {
        setSelected((s) => (s + dir + candidates.length) % candidates.length)
      } else if (history.current.length) {
        const h = history.current
        const next = historyIdx === null ? (dir < 0 ? h.length - 1 : null) : historyIdx + dir
        if (next === null || next >= h.length) {
          onChange('')
          setHistoryIdx(null)
        } else if (next >= 0) {
          onChange(h[next])
          setHistoryIdx(next)
        }
      }
    } else if (e.key === 'Enter' && onSubmit && value.trim()) {
      e.preventDefault()
      history.current = [...history.current.filter((c) => c !== value.trim()), value.trim()]
      setHistoryIdx(null)
      setListRequested(false)
      onSubmit()
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-black font-mono text-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-800 bg-slate-900 px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-xs text-slate-500">terminal simulada</span>
      </div>

      <div className="space-y-0.5 p-3" onClick={() => inputRef.current?.focus()}>
        {lines.map((l, i) => (
          <pre
            key={i}
            className={`break-all whitespace-pre-wrap ${l.kind === 'err' ? 'text-red-300' : l.kind === 'out' ? 'text-slate-300' : 'text-slate-100'}`}
          >
            {l.kind === 'cmd' ? <span className="text-emerald-400">$ </span> : null}
            {l.text}
          </pre>
        ))}

        {!disabled && (
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">$</span>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => change(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Terminal"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent text-slate-100 caret-emerald-400 outline-none"
            />
            {spec && (
              <button
                type="button"
                onClick={tab}
                className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-800"
                title="Autocompletar (tecla Tab)"
              >
                Tab ⇥
              </button>
            )}
          </div>
        )}
      </div>

      {listOpen && (
        <ul role="listbox" className="max-h-56 overflow-y-auto border-t border-slate-800 bg-slate-950">
          {candidates.map((c, i) => (
            <li
              key={c.value}
              role="option"
              aria-selected={i === selected}
              onMouseDown={(e) => {
                e.preventDefault()
                change(acceptCandidate(value, completion!, c.value))
                inputRef.current?.focus()
              }}
              className={`flex cursor-pointer gap-3 px-3 py-1 ${i === selected ? 'bg-sky-900/60' : 'hover:bg-slate-900'}`}
            >
              <span className="shrink-0 text-sky-300">{c.value}</span>
              {c.description && <span className="truncate font-sans text-xs leading-5 text-slate-400">{c.description}</span>}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <p className="border-t border-slate-800 px-3 py-1 font-sans text-xs text-slate-500">
          Tab: autocompletar · ↑↓: {listOpen ? 'elegir' : 'historial'} · Enter: ejecutar{listOpen ? ' · Esc: cerrar lista' : ''}
        </p>
      )}
    </div>
  )
}
