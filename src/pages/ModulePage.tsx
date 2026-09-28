import { Link } from 'react-router'
import { LockedNotice } from '../components/LockedNotice'
import { LEVEL_NAMES } from '../content/schema'
import { isSupported } from '../engine/grade'
import { exerciseKey, PASS_SCORE } from '../engine/progress'
import { Placeholder } from './Placeholder'
import { useModuleAccess } from './useModuleAccess'

const TYPE_LABEL = { quiz: 'Test', command: 'Comando', fill: 'Rellenar huecos', editor: 'Editor' } as const

export function ModulePage() {
  const { catalog, mod, locked, reasons, progress } = useModuleAccess()
  if (!mod) return <Placeholder title="Módulo no encontrado" phase="ninguna" />
  const track = catalog.tracks.find((t) => t.id === mod.trackId)
  const base = `/modulo/${mod.trackId}/${mod.slug}`
  const read = progress.lessonsRead[mod.ref] ?? []
  const exam = progress.exams[mod.ref]
  const disabled = locked ? 'pointer-events-none opacity-50' : ''

  return (
    <section>
      <Link to="/itinerarios" className="text-sm text-slate-400 hover:text-slate-200">
        ← {track?.title}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{mod.title}</h1>
      <p className="mt-2 text-slate-300">{mod.summary}</p>
      <p className="mt-1 text-sm text-slate-500">
        L{mod.level} · {LEVEL_NAMES[mod.level]} · {mod.xp} XP al aprobar
      </p>

      {locked && (
        <div className="mt-6">
          <LockedNotice reasons={reasons} />
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">
        1. Lecciones <span className="text-sm font-normal text-slate-500">({read.length}/{mod.lessons.length} leídas)</span>
      </h2>
      <ol className={`mt-3 space-y-2 ${disabled}`}>
        {mod.lessons.map((lesson, i) => (
          <li key={lesson.id}>
            <Link
              to={`${base}/leccion/${lesson.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 hover:border-sky-700"
            >
              <span>
                <span className="mr-3 text-slate-500">{i + 1}.</span>
                {lesson.frontmatter.title}
              </span>
              <span className="shrink-0 text-sm text-slate-500">
                {read.includes(lesson.id) ? <span className="text-emerald-400">✓ Leída</span> : `${lesson.frontmatter.minutes} min`}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <h2 className="mt-8 text-lg font-semibold">2. Práctica</h2>
      <ol className={`mt-3 grid gap-2 sm:grid-cols-2 ${disabled}`}>
        {mod.exercises.map((ex, i) => {
          const p = progress.exercises[exerciseKey(mod.ref, ex.id)]
          return (
            <li key={ex.id}>
              <Link
                to={`${base}/ejercicio/${ex.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 hover:border-sky-700"
              >
                <span>
                  <span className="mr-2 text-slate-500">{i + 1}.</span>
                  {TYPE_LABEL[ex.type]}
                  {!isSupported(ex) && <span className="ml-2 text-xs text-slate-500">(próximamente)</span>}
                </span>
                {p?.solved ? <span className="text-sm text-emerald-400">✓</span> : <span className="text-sm text-slate-600">○</span>}
              </Link>
            </li>
          )
        })}
      </ol>

      <h2 className="mt-8 text-lg font-semibold">3. Examen</h2>
      <div className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4 ${disabled}`}>
        <div className="text-sm text-slate-400">
          Aprueba con un {Math.round(PASS_SCORE * 100)}% para desbloquear el siguiente módulo.
          {exam && (
            <span className="mt-1 block">
              Mejor nota: <strong className="text-slate-200">{Math.round(exam.best * 100)}%</strong>
              {exam.passed && <span className="ml-2 text-emerald-400">✓ Aprobado</span>}
            </span>
          )}
        </div>
        <Link to={`${base}/examen`} className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500">
          {exam ? 'Repetir examen' : 'Hacer examen'}
        </Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold">4. Repaso</h2>
      <p className="mt-2 text-sm text-slate-400">
        {mod.flashcards.length} flashcards.{' '}
        {read.length === mod.lessons.length ? (
          <>
            Ya están en tu{' '}
            <Link to="/repaso" className="text-sky-400 hover:underline">
              repaso
            </Link>
            : volverán cuando toque repasarlas.
          </>
        ) : (
          'Se añaden a tu repaso cuando termines todas las lecciones del módulo.'
        )}
      </p>
    </section>
  )
}
