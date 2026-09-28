import { Link } from 'react-router'
import { getCatalog } from '../content/loader'
import { LEVEL_NAMES } from '../content/schema'
import { isUnlocked } from '../engine/progress'
import { useProgress } from '../store/progressStore'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function TrackMap() {
  const catalog = getCatalog()
  const { tracks, modules } = catalog
  const progress = useProgress()

  return (
    <section>
      <h1 className="text-3xl font-bold">Itinerarios</h1>
      <p className="mt-2 text-slate-400">
        Cuatro itinerarios paralelos, del nivel Principiante al nivel Entrevista.
      </p>

      <div className="mt-8 space-y-8">
        {tracks.map((track) => {
          const trackModules = modules.filter((m) => m.trackId === track.id)
          const levels = [...new Set(trackModules.map((m) => m.level))]
          return (
            <article key={track.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <header className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl font-semibold">{track.title}</h2>
                {track.optional && (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">Opcional</span>
                )}
              </header>
              <p className="mt-1 text-sm text-slate-400">{track.description}</p>

              {trackModules.length === 0 ? (
                <p className="mt-4 text-sm italic text-slate-500">Contenido en preparación.</p>
              ) : (
                levels.map((level) => (
                  <div key={level} className="mt-5">
                    <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      L{level} · {LEVEL_NAMES[level]}
                    </h3>
                    <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                      {trackModules
                        .filter((m) => m.level === level)
                        .map((m) => {
                          const passed = progress.exams[m.ref]?.passed
                          const open = isUnlocked(catalog, progress, m)
                          return (
                          <li key={m.ref}>
                            <Link
                              to={`/modulo/${m.trackId}/${m.slug}`}
                              className="block rounded-lg border border-slate-800 bg-slate-950 p-4 transition hover:border-sky-700"
                            >
                              <span className="flex items-start justify-between gap-2">
                                <span className="font-medium">{m.title}</span>
                                <span className="shrink-0 text-sm" title={passed ? 'Aprobado' : open ? 'Disponible' : 'Bloqueado'}>
                                  {passed ? <span className="text-emerald-400">✓</span> : open ? <span className="text-sky-400">●</span> : '🔒'}
                                </span>
                              </span>
                              <span className="mt-1 block text-sm text-slate-400">{m.summary}</span>
                              <span className="mt-2 block text-xs text-slate-500">
                                {plural(m.lessons.length, 'lección', 'lecciones')} · {plural(m.exercises.length, 'ejercicio', 'ejercicios')} · {m.xp} XP
                              </span>
                            </Link>
                          </li>
                          )
                        })}
                    </ul>
                  </div>
                ))
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
