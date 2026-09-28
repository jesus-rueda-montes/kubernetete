import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Grade } from 'ts-fsrs'
import { MarkdownView } from '../components/MarkdownView'
import { getCatalog } from '../content/loader'
import { availableCards, dueQueue, formatInterval, GRADE_LABEL, GRADES, nextDue, previewDue, type QueueItem } from '../engine/srs'
import { useProgress } from '../store/progressStore'

// Si tras valorar la tarjeta vuelve antes de esto, se repite en esta misma sesión.
const SAME_SESSION_MS = 20 * 60_000

const GRADE_STYLE: Record<Grade, string> = {
  1: 'border-red-800 hover:bg-red-950/50',
  2: 'border-amber-800 hover:bg-amber-950/50',
  3: 'border-emerald-800 hover:bg-emerald-950/50',
  4: 'border-sky-800 hover:bg-sky-950/50',
}

export function ReviewPage() {
  const catalog = getCatalog()
  const progress = useProgress()
  // La cola se fija al empezar la sesión para que no cambie bajo los pies.
  const [queue, setQueue] = useState<QueueItem[]>(() => dueQueue(catalog, progress, new Date()))
  const [reviewed, setReviewed] = useState(0)
  const [showBack, setShowBack] = useState(false)

  const current = queue[0]
  const stored = current ? progress.cards[current.key] : undefined
  const now = new Date()
  const due = current ? previewDue(stored, now) : null

  const rate = (grade: Grade) => {
    if (!current) return
    progress.review(current.key, grade)
    const nextAt = previewDue(stored, new Date())[grade]
    const again = nextAt.getTime() - Date.now() < SAME_SESSION_MS
    setQueue((q) => [...q.slice(1), ...(again ? [q[0]] : [])])
    setReviewed((n) => n + 1)
    setShowBack(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || e.target instanceof HTMLInputElement) return
      if (!showBack && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setShowBack(true)
      } else if (showBack && ['1', '2', '3', '4'].includes(e.key)) {
        rate(Number(e.key) as Grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!current) {
    const next = nextDue(catalog, progress)
    const available = availableCards(catalog, progress).length > 0
    return (
      <section className="max-w-2xl">
        <h1 className="text-2xl font-semibold">Repaso de hoy</h1>
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          {reviewed > 0 ? (
            <p className="text-lg">🎉 ¡Sesión terminada! Has repasado {reviewed} {reviewed === 1 ? 'tarjeta' : 'tarjetas'}.</p>
          ) : (
            <p className="text-lg">No tienes tarjetas pendientes ahora mismo.</p>
          )}
          {next && <p className="mt-2 text-slate-400">La próxima te tocará dentro de {formatInterval(new Date(), next)}.</p>}
          {!available && reviewed === 0 && (
            <p className="mt-3 text-sm text-slate-400">
              Las tarjetas de un módulo se añaden a tu repaso cuando terminas todas sus lecciones.{' '}
              <Link to="/itinerarios" className="text-sky-400 hover:underline">
                Ir a los itinerarios
              </Link>
            </p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="max-w-2xl">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Repaso de hoy</h1>
        <span className="text-sm text-slate-500">
          {reviewed} hechas · {queue.length} pendientes
        </span>
      </div>

      <article className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-6">
        <p className="text-xs text-slate-500">
          {current.mod.title}
          {!stored && <span className="ml-2 rounded-full bg-sky-900/60 px-2 py-0.5 text-sky-300">Nueva</span>}
        </p>
        <div className="mt-3 text-lg font-medium [&_p]:my-1">
          <MarkdownView source={current.card.front} />
        </div>

        {showBack ? (
          <div className="mt-5 border-t border-slate-700 pt-4 [&_p]:my-1">
            <MarkdownView source={current.card.back} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowBack(true)}
            className="mt-6 w-full rounded-md bg-sky-600 py-2.5 font-medium text-white hover:bg-sky-500"
          >
            Mostrar respuesta <span className="text-sky-200/70">(Espacio)</span>
          </button>
        )}
      </article>

      {showBack && due && (
        <>
          <p className="mt-5 text-sm text-slate-400">¿Qué tal la recordabas? Según tu respuesta, volverá antes o después:</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADES.map((g, i) => (
              <button
                key={g}
                type="button"
                onClick={() => rate(g)}
                className={`rounded-lg border bg-slate-900 px-3 py-2 text-center ${GRADE_STYLE[g]}`}
              >
                <span className="block font-medium">{GRADE_LABEL[g]}</span>
                <span className="block text-xs text-slate-400">
                  {formatInterval(now, due[g])} · tecla {i + 1}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
