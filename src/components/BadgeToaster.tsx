import { useEffect, useState } from 'react'
import { getCatalog } from '../content/loader'
import { computeBadges, earnedIds, type Badge } from '../engine/badges'
import { isBulkChange, useProgress } from '../store/progressStore'

/** Aviso flotante cuando se gana una insignia nueva. */
export function BadgeToaster() {
  const [toasts, setToasts] = useState<Badge[]>([])

  useEffect(
    () =>
      useProgress.subscribe((state, prev) => {
        if (isBulkChange()) return
        const catalog = getCatalog()
        const before = earnedIds(computeBadges(catalog, prev))
        const fresh = computeBadges(catalog, state).filter((b) => b.earned && !before.has(b.id))
        if (fresh.length === 0) return
        setToasts((t) => [...t, ...fresh])
        setTimeout(() => setToasts((t) => t.filter((x) => !fresh.includes(x))), 6000)
      }),
    [],
  )

  if (toasts.length === 0) return null
  return (
    <div className="fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto" role="status" aria-live="polite">
      {toasts.map((b) => (
        <div key={b.id} className="flex w-full items-center gap-3 rounded-xl border border-amber-600 bg-slate-900 p-4 shadow-2xl sm:w-80">
          <span className="text-3xl" aria-hidden>
            {b.icon}
          </span>
          <span>
            <span className="block text-xs text-amber-300">¡Nueva insignia!</span>
            <span className="block font-semibold">{b.title}</span>
            <span className="block text-sm text-slate-400">{b.description}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
