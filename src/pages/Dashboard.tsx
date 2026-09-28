import { Link } from 'react-router'
import { getCatalog } from '../content/loader'
import { BadgeGrid } from '../components/BadgeGrid'
import { computeBadges } from '../engine/badges'
import { isUnlocked } from '../engine/progress'
import { dueQueue } from '../engine/srs'
import { useProgress } from '../store/progressStore'

export function Dashboard() {
  const catalog = getCatalog()
  const progress = useProgress()
  const passed = catalog.modules.filter((m) => progress.exams[m.ref]?.passed).length
  // Siguiente paso: el primer módulo abierto y sin aprobar (itinerarios no opcionales primero).
  const optional = new Set(catalog.tracks.filter((t) => t.optional).map((t) => t.id))
  const next = [...catalog.modules]
    .sort((a, b) => Number(optional.has(a.trackId)) - Number(optional.has(b.trackId)))
    .find((m) => !progress.exams[m.ref]?.passed && isUnlocked(catalog, progress, m))

  const dueCards = dueQueue(catalog, progress, new Date()).length
  const badges = computeBadges(catalog, progress)
  const earned = badges.filter((b) => b.earned).length

  const stats = [
    { label: 'XP', value: progress.xp },
    { label: 'Racha', value: `${progress.streak.current} ${progress.streak.current === 1 ? 'día' : 'días'}` },
    { label: 'Mejor racha', value: `${progress.streak.best} d` },
    { label: 'Módulos aprobados', value: `${passed}/${catalog.modules.length}` },
  ]

  return (
    <section>
      <h1 className="text-3xl font-bold">Bienvenido a Kubernetete</h1>
      <p className="mt-3 max-w-prose text-slate-300">
        De principiante a nivel de entrevista técnica en Cloud, Kubernetes, Terraform y Ansible.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <dt className="text-xs text-slate-500 uppercase">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>

      {dueCards > 0 && (
        <Link
          to="/repaso"
          className="mt-8 flex items-center justify-between gap-3 rounded-xl border border-violet-900 bg-violet-950/30 p-5 hover:border-violet-700"
        >
          <span>
            <span className="block text-sm text-violet-300">Repaso de hoy</span>
            <span className="text-xl font-semibold">
              {dueCards} {dueCards === 1 ? 'tarjeta pendiente' : 'tarjetas pendientes'}
            </span>
          </span>
          <span className="text-violet-300">Repasar →</span>
        </Link>
      )}

      {next && (
        <div className="mt-8 rounded-xl border border-sky-900 bg-sky-950/30 p-5">
          <p className="text-sm text-sky-300">Continúa por aquí</p>
          <p className="mt-1 text-xl font-semibold">{next.title}</p>
          <p className="mt-1 text-sm text-slate-400">{next.summary}</p>
          <Link
            to={`/modulo/${next.trackId}/${next.slug}`}
            className="mt-4 inline-block rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500"
          >
            Ir al módulo
          </Link>
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold">
        Insignias <span className="text-sm font-normal text-slate-500">({earned}/{badges.length})</span>
      </h2>
      <div className="mt-3">
        {/* Primero las conseguidas */}
        <BadgeGrid badges={[...badges].sort((a, b) => Number(b.earned) - Number(a.earned))} />
      </div>
    </section>
  )
}
