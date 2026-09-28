import type { Badge } from '../engine/badges'

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {badges.map((b) => (
        <li
          key={b.id}
          className={`rounded-lg border p-3 ${b.earned ? 'border-amber-700 bg-amber-950/20' : 'border-slate-800 bg-slate-900/40'}`}
          title={b.description}
        >
          <span className={`text-2xl ${b.earned ? '' : 'opacity-30 grayscale'}`} aria-hidden>
            {b.icon}
          </span>
          <span className={`mt-1 block text-sm font-medium ${b.earned ? 'text-slate-100' : 'text-slate-400'}`}>{b.title}</span>
          <span className="block text-xs text-slate-500">{b.description}</span>
          {!b.earned && b.target > 1 && (
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-800" aria-label={`${b.current} de ${b.target}`}>
              <span className="block h-full bg-amber-600" style={{ width: `${(b.current / b.target) * 100}%` }} />
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
